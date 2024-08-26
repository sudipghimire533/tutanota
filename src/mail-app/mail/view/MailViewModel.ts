import { ListModel } from "../../../common/misc/ListModel.js"
import { MailboxDetail, MailModel } from "../../../common/mailFunctionality/MailModel.js"
import { EntityClient } from "../../../common/api/common/EntityClient.js"
import { Mail, MailFolder, MailTypeRef } from "../../../common/api/entities/tutanota/TypeRefs.js"
import { firstBiggerThanSecond, GENERATED_MAX_ID, getElementId, isSameId, sortCompareByReverseId } from "../../../common/api/common/utils/EntityUtils.js"
import {
	assertNotNull,
	count,
	debounce,
	first,
	lastThrow,
	lazyMemoized,
	mapWith,
	mapWithout,
	memoized,
	noOp,
	ofClass,
	promiseFilter,
} from "@tutao/tutanota-utils"
import { ListState } from "../../../common/gui/base/List.js"
import { ConversationPrefProvider, ConversationViewModel, ConversationViewModelFactory } from "./ConversationViewModel.js"
import { CreateMailViewerOptions } from "./MailViewer.js"
import { isOfflineError } from "../../../common/api/common/utils/ErrorUtils.js"
import { MailFolderType, OperationType } from "../../../common/api/common/TutanotaConstants.js"
import { WsConnectionState } from "../../../common/api/main/WorkerClient.js"
import { WebsocketConnectivityModel } from "../../../common/misc/WebsocketConnectivityModel.js"
import { ExposedCacheStorage } from "../../../common/api/worker/rest/DefaultEntityRestCache.js"
import { NotFoundError, PreconditionFailedError } from "../../../common/api/common/error/RestError.js"
import { UserError } from "../../../common/api/main/UserError.js"
import { ProgrammingError } from "../../../common/api/common/error/ProgrammingError.js"
import Stream from "mithril/stream"
import { InboxRuleHandler } from "../model/InboxRuleHandler.js"
import { Router } from "../../../common/gui/ScopedRouter.js"
import { ListFetchResult } from "../../../common/gui/base/ListUtils.js"
import { EntityUpdateData, isUpdateForTypeRef } from "../../../common/api/common/utils/EntityUpdateUtils.js"
import { EventController } from "../../../common/api/main/EventController.js"
import { assertSystemFolderOfType, getMailFilterForType, isOfTypeOrSubfolderOf, MailFilterType } from "../../../common/mailFunctionality/SharedMailUtils.js"
import { isSpamOrTrashFolder, isSubfolderOfType } from "../../../common/api/common/CommonMailUtils.js"
import { CacheMode } from "../../../common/api/worker/rest/EntityRestClient.js"

export interface MailOpenedListener {
	onEmailOpened(mail: Mail): unknown
}

const TAG = "MailVM"

/** ViewModel for the overall mail view. */
export class MailViewModel {
	private _listId: Id | null = null
	/** id of the mail we are trying to load based on the URL */
	private targetMailId: Id | null = null
	/** needed to prevent parallel target loads*/
	private loadingToTargetId: Id | null = null
	private conversationViewModel: ConversationViewModel | null = null
	private _filterType: MailFilterType | null = null

	/**
	 * We remember the last URL used for each folder so if we switch between folders we can keep the selected mail.
	 * There's a similar (but different) hacky mechanism where we store last URL but per each top-level view: navButtonRoutes. This one is per folder.
	 */
	private mailListToSelectedMail: ReadonlyMap<Id, Id> = new Map()
	private listStreamSubscription: Stream<unknown> | null = null
	private conversationPref: boolean = false

	constructor(
		private readonly mailModel: MailModel,
		private readonly entityClient: EntityClient,
		private readonly eventController: EventController,
		private readonly connectivityModel: WebsocketConnectivityModel,
		private readonly cacheStorage: ExposedCacheStorage,
		private readonly conversationViewModelFactory: ConversationViewModelFactory,
		private readonly mailOpenedListener: MailOpenedListener,
		private readonly conversationPrefProvider: ConversationPrefProvider,
		private readonly inboxRuleHandler: InboxRuleHandler,
		private readonly router: Router,
		private readonly updateUi: () => unknown,
	) {}

	get filterType(): MailFilterType | null {
		return this._filterType
	}

	setFilter(filter: MailFilterType | null) {
		this._filterType = filter
		this.listModel?.setFilter(getMailFilterForType(filter))
	}

	/**
	 * @param listId
	 * @param mailId
	 * @param explicitOpenIntent whether user explicitly request the email to be opened, e.g. through notificaiton. Will load this email with higher priority
	 * than loading the list.
	 * @param onMissingExplicitMailTarget
	 */
	async showMail(listId?: Id, mailId?: Id, explicitOpenIntent?: boolean, onMissingExplicitMailTarget: () => unknown = noOp) {
		// an optimization to not open an email that we already display
		if (listId != null && mailId != null && this.conversationViewModel && isSameId(this.conversationViewModel.primaryMail._id, [listId, mailId])) {
			return
		}

		// important to set it early enough because setting listId will trigger URL update.
		// if we don't set this one before setListId, url update will cause this function to be called again but without target mail and we will lose the
		// target URL
		this.targetMailId = typeof mailId === "string" ? mailId : null

		let listIdToUse
		if (typeof listId === "string") {
			const mailboxDetail = await this.mailModel.getMailboxDetailsForMailListId(listId)
			if (mailboxDetail) {
				listIdToUse = listId
			} else {
				listIdToUse = await this.getListIdForUserInbox()
			}
		} else {
			listIdToUse = this._listId ?? (await this.getListIdForUserInbox())
		}

		this.setListId(listIdToUse)

		if (listId && mailId && explicitOpenIntent) {
			try {
				// On URL update (with the same mail id but without explicit intent) this branch would be skipped and the list loading below would start.
				// This is a problem for us because it would reset target mail id once it's done loading and we wouldn't handle the loaded mail.
				// Setting loadingToTargetId here will skip the parallel list loading from the subsequent call, we will wait for loadTargetMail to finish in
				// the original call and then proceed with list loading.
				//
				// It is important that the second call does not reach this point before the first call, otherwise it turns racy and target mail id will be
				// reset before we are done loading.
				this.loadingToTargetId = mailId
				console.log(TAG, "Loading explicit email target", listId, mailId)
				await this.loadExplicitMailTarget(listId, mailId, onMissingExplicitMailTarget)
			} finally {
				// make sure to not reset loading state if target was already changed in the meantime
				if (this.targetMailId === mailId) {
					this.loadingToTargetId = null
				}
			}
		}

		// if there is a target id and we are not loading for this id already then start loading towards that id
		if (this.targetMailId && this.targetMailId != this.loadingToTargetId) {
			console.log(TAG, "target mail", this.targetMailId, this.loadingToTargetId)
			this.mailListToSelectedMail = mapWith(this.mailListToSelectedMail, listIdToUse, this.targetMailId)
			try {
				this.loadingToTargetId = this.targetMailId
				const foundMail = await this.loadAndSelectMail([listIdToUse, this.targetMailId])
				if (foundMail == null) {
					console.log(TAG, "did not find mail", listId, mailId)
				}
			} finally {
				// Update the state but only if it didn't get changed to something else already, then it's not our responsibility but whoever else is doing
				// loading in parallel.
				if (this.targetMailId === mailId && !explicitOpenIntent) {
					this.targetMailId = null
				}
				if (this.loadingToTargetId == mailId) {
					this.loadingToTargetId = null
				}
				// If we are done with loading we should update the URL. Maybe we couldn't load target mail id and we need to remove it from the url.
				this.updateUrl()
			}
		} else {
			// update URL if the view was just opened without any url params
			// setListId might not have done it if the list didn't change for us internally but is changed for the view
			if (listId == null) this.updateUrl()
		}
	}

	private async loadExplicitMailTarget(listId: Id, mailId: Id, onMissingTargetEmail: () => unknown) {
		const cached = await this.cacheStorage.get(MailTypeRef, listId, mailId)
		if (cached) {
			console.log(TAG, "opening cached mail", mailId)
			this.createConversationViewModel({ mail: cached, showFolder: false })
			this.listModel?.selectNone()
			this.updateUi()
		}

		if (this.targetMailId !== mailId) {
			console.log(TAG, "target mail id changed 1", mailId, this.targetMailId)
			return
		}

		let mail: Mail | null
		try {
			mail = await this.entityClient.load(MailTypeRef, [listId, mailId], { cacheMode: CacheMode.Bypass }).catch(ofClass(NotFoundError, () => null))
		} catch (e) {
			if (isOfflineError(e)) {
				return
			} else {
				throw e
			}
		}

		if (this.targetMailId !== mailId) {
			console.log(TAG, "target mail id changed 2", mailId, this.targetMailId)
			return
		}

		if (mail) {
			this.createConversationViewModel({ mail, showFolder: false })
			this.listModel?.selectNone()
			this.updateUi()
		} else {
			console.log(TAG, "Explicit mail target is not found", listId, mailId)
			onMissingTargetEmail()
			// We already know that email is not there, we can reset the target here and avoid list loading
			this.targetMailId = null
			this.updateUrl()
		}
	}

	private async loadAndSelectMail([listId, mailId]: IdTuple): Promise<Mail | null> {
		const foundMail = await assertNotNull(this.listModel).loadAndSelect(
			mailId,
			() =>
				// if we changed the list, stop
				this.getListId() !== listId ||
				// if listModel is gone for some reason, stop
				!this.listModel ||
				// if the target mail has changed, stop
				this.targetMailId !== mailId ||
				// if we loaded past the target item we won't find it, stop
				(this.listModel.state.items.length > 0 && firstBiggerThanSecond(mailId, getElementId(lastThrow(this.listModel.state.items)))),
		)

		return foundMail ?? null
	}

	private async getListIdForUserInbox(): Promise<Id> {
		const mailboxDetail = await this.mailModel.getUserMailboxDetails()
		return assertSystemFolderOfType(mailboxDetail.folders, MailFolderType.INBOX).mails
	}

	init() {
		this.singInit()
		const conversationEnabled = this.conversationPrefProvider.getConversationViewShowOnlySelectedMail()
		if (this.conversationViewModel && this.conversationPref !== conversationEnabled) {
			const mail = this.conversationViewModel.primaryMail
			this.createConversationViewModel({
				mail,
				showFolder: false,
				delayBodyRenderingUntil: Promise.resolve(),
			})
			this.mailOpenedListener.onEmailOpened(mail)
		}
		this.conversationPref = conversationEnabled
	}

	private readonly singInit = lazyMemoized(() => {
		this.eventController.addEntityListener((updates) => this.entityEventsReceived(updates))
	})

	get listModel(): ListModel<Mail> | null {
		return this._listId ? this._listModel(this._listId) : null
	}

	getMailListToSelectedMail(): ReadonlyMap<Id, Id> {
		return this.mailListToSelectedMail
	}

	getListId(): Id | null {
		return this._listId
	}

	private setListId(id: Id) {
		if (id === this._listId) {
			return
		}
		// Cancel old load all
		this.listModel?.cancelLoadAll()
		this._filterType = null

		this._listId = id
		this.listStreamSubscription?.end(true)
		this.listStreamSubscription = this.listModel!.stateStream.map((state) => this.onListStateChange(state))
		this.listModel!.loadInitial()
	}

	getConversationViewModel(): ConversationViewModel | null {
		return this.conversationViewModel
	}

	private _listModel = memoized((listId: Id) => {
		return new ListModel<Mail>({
			topId: GENERATED_MAX_ID,
			fetch: async (startId, count) => {
				const { complete, items } = await this.loadMailRange(listId, startId, count)
				if (complete) {
					this.fixCounterIfNeeded(listId, [])
				}
				return { complete, items }
			},
			loadSingle: (elementId: Id): Promise<Mail | null> => this.entityClient.load(MailTypeRef, [listId, elementId]),
			sortCompare: sortCompareByReverseId,
			autoSelectBehavior: () => this.conversationPrefProvider.getMailAutoSelectBehavior(),
		})
	})

	private fixCounterIfNeeded: (listId: Id, itemsWhenCalled: ReadonlyArray<Mail>) => void = debounce(
		2000,
		async (listId: Id, itemsWhenCalled: ReadonlyArray<Mail>) => {
			if (this._filterType != null && this.filterType !== MailFilterType.Unread) {
				return
			}

			// If folders are changed, list won't have the data we need.
			// Do not rely on counters if we are not connected
			if (this.getListId() !== listId || this.connectivityModel.wsConnection()() !== WsConnectionState.connected) {
				return
			}

			// If list was modified in the meantime, we cannot be sure that we will fix counters correctly (e.g. because of the inbox rules)
			if (this.listModel?.state.items !== itemsWhenCalled) {
				console.log(`list changed, trying again later`)
				return this.fixCounterIfNeeded(listId, this.listModel?.state.items ?? [])
			}

			const unreadMailsCount = count(this.listModel.state.items, (e) => e.unread)

			const counterValue = await this.mailModel.getCounterValue(listId)
			if (counterValue != null && counterValue !== unreadMailsCount) {
				console.log(`fixing up counter for list ${listId}`)
				await this.mailModel.fixupCounterForMailList(listId, unreadMailsCount)
			} else {
				console.log(`same counter, no fixup on list ${listId}`)
			}
		},
	)

	private onListStateChange(newState: ListState<Mail>) {
		// If we are showing the target mail ignore the state changes from the list. We will reset the target on user selection, url changes and
		// entity events separately.
		const targetItem = this.targetMailId
			? newState.items.find((item) => getElementId(item) === this.targetMailId)
			: !newState.inMultiselect && newState.selectedItems.size === 1
			? first(this.listModel!.getSelectedAsArray())
			: null
		if (targetItem) {
			if (!this.conversationViewModel || !isSameId(this.conversationViewModel?.primaryMail._id, targetItem._id)) {
				this.mailListToSelectedMail = mapWith(this.mailListToSelectedMail, assertNotNull(this.getListId()), getElementId(targetItem))

				this.createConversationViewModel({
					mail: targetItem,
					showFolder: false,
				})
				this.mailOpenedListener.onEmailOpened(targetItem)
			}
		} else {
			this.conversationViewModel?.dispose()
			this.conversationViewModel = null
			this.mailListToSelectedMail = mapWithout(this.mailListToSelectedMail, assertNotNull(this.getListId()))
		}
		this.updateUrl()
		this.updateUi()
	}

	private updateUrl() {
		const listId = this._listId
		const mailId = this.targetMailId ?? (listId ? this.getMailListToSelectedMail().get(listId) : null)
		if (mailId != null) {
			this.router.routeTo("/mail/:listId/:mailId", { listId, mailId })
		} else {
			this.router.routeTo("/mail/:listId", { listId: listId ?? "" })
		}
	}

	private createConversationViewModel(viewModelParams: CreateMailViewerOptions) {
		this.conversationViewModel?.dispose()
		this.conversationViewModel = this.conversationViewModelFactory(viewModelParams)
	}

	async entityEventsReceived(updates: ReadonlyArray<EntityUpdateData>) {
		for (const update of updates) {
			if (isUpdateForTypeRef(MailTypeRef, update) && update.instanceListId === this._listId) {
				// Reset target before we dispatch event to the list so that our handler in onListStateChange() has up-to-date state.
				if (update.instanceId === this.targetMailId) {
					if (update.operation === OperationType.DELETE) {
						this.targetMailId = null
					}
				}
				await this.listModel?.entityEventReceived(update.instanceId, update.operation)
			}
		}
	}

	private async loadMailRange(listId: Id, start: Id, count: number): Promise<ListFetchResult<Mail>> {
		try {
			const items = await this.entityClient.loadRange(MailTypeRef, listId, start, count, true)
			const mailboxDetail = await this.mailModel.getMailboxDetailsForMailListId(listId)
			// For inbox rules there are two points where we might want to apply them. The first one is MailModel which applied inbox rules as they are received
			// in real time. The second one is here, when we load emails in inbox. If they are unread we want to apply inbox rules to them. If inbox rule
			// applies, the email is moved out of the inbox and we don't return it here.
			if (mailboxDetail) {
				const mailsToKeepInInbox = await promiseFilter(items, async (mail) => {
					const wasMatched = await this.inboxRuleHandler.findAndApplyMatchingRule(mailboxDetail, mail, true)
					return !wasMatched
				})
				return { items: mailsToKeepInInbox, complete: items.length < count }
			} else {
				return { items, complete: items.length < count }
			}
		} catch (e) {
			// The way the cache works is that it tries to fulfill the API contract of returning as many items as requested as long as it can.
			// This is problematic for offline where we might not have the full page of emails loaded (e.g. we delete part as it's too old or we move emails
			// around). Because of that cache will try to load additional items from the server in order to return `count` items. If it fails to load them,
			// it will not return anything and instead will throw an error.
			// This is generally fine but in case of offline we want to display everything that we have cached. For that we fetch directly from the cache,
			// give it to the list and let list make another request (and almost certainly fail that request) to show a retry button. This way we both show
			// the items we have and also show that we couldn't load everything.
			if (isOfflineError(e)) {
				const items = await this.cacheStorage.provideFromRange(MailTypeRef, listId, start, count, true)
				if (items.length === 0) throw e
				return { items, complete: false }
			} else {
				throw e
			}
		}
	}

	async switchToFolder(folderType: Omit<MailFolderType, MailFolderType.CUSTOM>): Promise<void> {
		const mailboxDetail = assertNotNull(await this.getMailboxDetails())
		const listId = assertSystemFolderOfType(mailboxDetail.folders, folderType).mails
		await this.showMail(listId, this.mailListToSelectedMail.get(listId))
	}

	async getMailboxDetails(): Promise<MailboxDetail> {
		const listId = this.getListId()
		return await this.mailboxDetailForListWithFallback(listId)
	}

	getSelectedFolder(): MailFolder | null {
		const listId = this.getListId()
		return listId ? this.mailModel.getMailFolder(listId) : null
	}

	async showingDraftsFolder(): Promise<boolean> {
		if (!this._listId) return false
		const mailboxDetail = await this.mailModel.getMailboxDetailsForMailListId(this._listId)
		const selectedFolder = this.getSelectedFolder()
		if (selectedFolder && mailboxDetail) {
			return isOfTypeOrSubfolderOf(mailboxDetail.folders, selectedFolder, MailFolderType.DRAFT)
		} else {
			return false
		}
	}

	async showingTrashOrSpamFolder(): Promise<boolean> {
		const listId = this._listId
		if (!listId) return false
		const folder = await this.mailModel.getMailFolder(listId)
		if (!folder) {
			return false
		}
		const mailboxDetail = await this.mailModel.getMailboxDetailsForMailListId(listId)
		return mailboxDetail != null && isSpamOrTrashFolder(mailboxDetail.folders, folder)
	}

	private async mailboxDetailForListWithFallback(listId?: string | null) {
		const mailboxDetailForListId = typeof listId === "string" ? await this.mailModel.getMailboxDetailsForMailListId(listId) : null
		return mailboxDetailForListId ?? (await this.mailModel.getUserMailboxDetails())
	}

	async finallyDeleteAllMailsInSelectedFolder(folder: MailFolder): Promise<void> {
		// remove any selection to avoid that the next mail is loaded and selected for each deleted mail event
		this.listModel?.selectNone()

		const mailboxDetail = await this.getMailboxDetails()

		// the request is handled a little differently if it is the system folder vs a subfolder
		if (folder.folderType === MailFolderType.TRASH || folder.folderType === MailFolderType.SPAM) {
			return this.mailModel.clearFolder(folder).catch(
				ofClass(PreconditionFailedError, () => {
					throw new UserError("operationStillActive_msg")
				}),
			)
		} else if (
			isSubfolderOfType(mailboxDetail.folders, folder, MailFolderType.TRASH) ||
			isSubfolderOfType(mailboxDetail.folders, folder, MailFolderType.SPAM)
		) {
			return this.mailModel.finallyDeleteCustomMailFolder(folder).catch(
				ofClass(PreconditionFailedError, () => {
					throw new UserError("operationStillActive_msg")
				}),
			)
		} else {
			throw new ProgrammingError(`Cannot delete mails in folder ${String(folder._id)} with type ${folder.folderType}`)
		}
	}

	onSingleSelection(mail: Mail) {
		this.targetMailId = null
		this.listModel?.onSingleSelection(mail)
	}

	areAllSelected(): boolean {
		return this.listModel?.areAllSelected() ?? false
	}

	selectNone(): void {
		this.targetMailId = null
		this.listModel?.selectNone()
	}

	selectAll(): void {
		this.targetMailId = null
		this.listModel?.selectAll()
	}

	onSingleInclusiveSelection(mail: Mail, clearSelectionOnMultiSelectStart?: boolean) {
		this.targetMailId = null
		this.listModel?.onSingleInclusiveSelection(mail, clearSelectionOnMultiSelectStart)
	}

	onRangeSelectionTowards(mail: Mail) {
		this.targetMailId = null
		this.listModel?.selectRangeTowards(mail)
	}

	selectPrevious(multiselect: boolean) {
		this.targetMailId = null
		this.listModel?.selectPrevious(multiselect)
	}

	selectNext(multiselect: boolean) {
		this.targetMailId = null
		this.listModel?.selectNext(multiselect)
	}

	onSingleExclusiveSelection(mail: Mail) {
		this.targetMailId = null
		this.listModel?.onSingleExclusiveSelection(mail)
	}
}
