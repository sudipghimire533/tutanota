import type { WorkerClient } from "./WorkerClient"
import { bootstrapWorker } from "./WorkerClient"
import { EventController } from "./EventController"
import { EntropyCollector } from "./EntropyCollector"
import { SearchModel } from "../../../mail-app/search/model/SearchModel"
import { MailboxDetail, MailModel } from "../../mailFunctionality/MailModel.js"
import { assertMainOrNode, isAndroidApp, isApp, isBrowser, isDesktop, isElectronClient, isIOSApp } from "../common/Env"
import { notifications } from "../../gui/Notifications"
import { LoginController } from "./LoginController"
import type { ContactModel } from "../../contactsFunctionality/ContactModel.js"
import { EntityClient } from "../common/EntityClient"
import { defer, DeferredObject, lazy, lazyAsync, lazyMemoized } from "@tutao/tutanota-utils"
import { ProgressTracker } from "./ProgressTracker"
import type { CredentialsProvider } from "../../misc/credentials/CredentialsProvider.js"
import type { LoginFacade } from "../worker/facades/LoginFacade"
import type { CustomerFacade } from "../worker/facades/lazy/CustomerFacade.js"
import type { GiftCardFacade } from "../worker/facades/lazy/GiftCardFacade.js"
import type { ConfigurationDatabase } from "../worker/facades/lazy/ConfigurationDatabase.js"
import type { CalendarFacade } from "../worker/facades/lazy/CalendarFacade.js"
import type { MailFacade } from "../worker/facades/lazy/MailFacade.js"
import type { ShareFacade } from "../worker/facades/lazy/ShareFacade.js"
import type { CounterFacade } from "../worker/facades/lazy/CounterFacade.js"
import type { Indexer } from "../worker/search/Indexer"
import type { SearchFacade } from "../worker/search/SearchFacade"
import type { BookingFacade } from "../worker/facades/lazy/BookingFacade.js"
import type { MailAddressFacade } from "../worker/facades/lazy/MailAddressFacade.js"
import { SecondFactorHandler } from "../../misc/2fa/SecondFactorHandler"
import { WebauthnClient } from "../../misc/2fa/webauthn/WebauthnClient"
import type { UserManagementFacade } from "../worker/facades/lazy/UserManagementFacade.js"
import type { GroupManagementFacade } from "../worker/facades/lazy/GroupManagementFacade.js"
import { WorkerRandomizer } from "../worker/WorkerImpl"
import { BrowserWebauthn } from "../../misc/2fa/webauthn/BrowserWebauthn.js"
import { UsageTestController } from "@tutao/tutanota-usagetests"
import { EphemeralUsageTestStorage, StorageBehavior, UsageTestModel } from "../../misc/UsageTestModel"
import { deviceConfig } from "../../misc/DeviceConfig"
import { IServiceExecutor } from "../common/ServiceRequest.js"
import type { BlobFacade } from "../worker/facades/lazy/BlobFacade.js"
import { CryptoFacade } from "../worker/crypto/CryptoFacade"
import { RecipientsModel } from "./RecipientsModel"
import { ExposedCacheStorage } from "../worker/rest/DefaultEntityRestCache.js"
import { PageContextLoginListener } from "./PageContextLoginListener.js"
import { SearchTextInAppFacade } from "../../native/common/generatedipc/SearchTextInAppFacade.js"
import { SettingsFacade } from "../../native/common/generatedipc/SettingsFacade.js"
import { DesktopSystemFacade } from "../../native/common/generatedipc/DesktopSystemFacade.js"
import { InterWindowEventFacadeSendDispatcher } from "../../native/common/generatedipc/InterWindowEventFacadeSendDispatcher.js"
import { NewsModel } from "../../misc/news/NewsModel.js"
import type { MailAddressNameChanger, MailAddressTableModel } from "../../../mail-app/settings/mailaddress/MailAddressTableModel.js"
import { GroupInfo } from "../entities/sys/TypeRefs.js"
import type { SendMailModel } from "../../mailFunctionality/SendMailModel.js"
import type { MailboxProperties } from "../entities/tutanota/TypeRefs.js"
import { NoZoneDateProvider } from "../common/utils/NoZoneDateProvider.js"
import { WebsocketConnectivityModel } from "../../misc/WebsocketConnectivityModel.js"
import { DrawerMenuAttrs } from "../../gui/nav/DrawerMenu.js"
import { EntropyFacade } from "../worker/facades/EntropyFacade.js"
import { OperationProgressTracker } from "./OperationProgressTracker.js"
import { WorkerFacade } from "../worker/facades/WorkerFacade.js"
import { InfoMessageHandler } from "../../gui/InfoMessageHandler.js"
import { OfflineIndicatorViewModel } from "../../gui/base/OfflineIndicatorViewModel.js"
import { AppHeaderAttrs, Header } from "../../gui/Header.js"
import { ReceivedGroupInvitationsModel } from "../../sharing/model/ReceivedGroupInvitationsModel.js"
import { Const, KdfType } from "../common/TutanotaConstants.js"
import { SearchViewModel } from "../../../mail-app/search/view/SearchViewModel.js"
import { SearchRouter } from "../../../mail-app/search/view/SearchRouter.js"
import { Router, ScopedRouter, ThrottledRouter } from "../../gui/ScopedRouter.js"
import { ShareableGroupType } from "../../sharing/GroupUtils.js"
import { DomainConfigProvider } from "../common/DomainConfigProvider.js"
import { ContactFacade } from "../worker/facades/lazy/ContactFacade.js"
import { WebMobileFacade } from "../../native/main/WebMobileFacade.js"
import { CredentialFormatMigrator } from "../../misc/credentials/CredentialFormatMigrator.js"
import { SqlCipherFacade } from "../../native/common/generatedipc/SqlCipherFacade.js"
import { SystemPermissionHandler } from "../../native/main/SystemPermissionHandler.js"
import { RecoverCodeFacade } from "../worker/facades/lazy/RecoverCodeFacade.js"
import { SchedulerImpl } from "../common/utils/Scheduler.js"
import type { AlarmScheduler } from "../../../calendar-app/calendar/date/AlarmScheduler.js"

assertMainOrNode()

class MainLocator {
	eventController!: EventController
	mailModel!: MailModel
	contactModel!: ContactModel
	entityClient!: EntityClient
	progressTracker!: ProgressTracker
	worker!: WorkerClient
	loginFacade!: LoginFacade
	logins!: LoginController
	header!: Header
	customerFacade!: CustomerFacade
	giftCardFacade!: GiftCardFacade
	groupManagementFacade!: GroupManagementFacade
	configFacade!: ConfigurationDatabase
	calendarFacade!: CalendarFacade
	mailFacade!: MailFacade
	shareFacade!: ShareFacade
	counterFacade!: CounterFacade
	indexerFacade!: Indexer
	searchFacade!: SearchFacade
	bookingFacade!: BookingFacade
	mailAddressFacade!: MailAddressFacade
	blobFacade!: BlobFacade
	userManagementFacade!: UserManagementFacade
	recoverCodeFacade!: RecoverCodeFacade
	contactFacade!: ContactFacade
	usageTestController!: UsageTestController
	usageTestModel!: UsageTestModel
	serviceExecutor!: IServiceExecutor
	cryptoFacade!: CryptoFacade
	webMobileFacade!: WebMobileFacade
	cacheStorage!: ExposedCacheStorage
	workerFacade!: WorkerFacade
	random!: WorkerRandomizer
	connectivityModel!: WebsocketConnectivityModel
	operationProgressTracker!: OperationProgressTracker
	Const!: Record<string, any>

	entropyFacade!: EntropyFacade
	sqlCipherFacade!: SqlCipherFacade

	readonly recipientsModel: lazyAsync<RecipientsModel> = lazyMemoized(async () => {
		const { RecipientsModel } = await import("./RecipientsModel.js")
		return new RecipientsModel(this.contactModel, this.logins, this.mailFacade, this.entityClient)
	})

	async noZoneDateProvider(): Promise<NoZoneDateProvider> {
		return new NoZoneDateProvider()
	}

	async sendMailModel(mailboxDetails: MailboxDetail, mailboxProperties: MailboxProperties): Promise<SendMailModel> {
		const factory = await this.sendMailModelSyncFactory(mailboxDetails, mailboxProperties)
		return factory()
	}

	readonly redraw: lazyAsync<() => unknown> = lazyMemoized(async () => {
		const m = await import("mithril")
		return m.redraw
	})

	readonly throttledRouter: lazy<Router> = lazyMemoized(() => new ThrottledRouter())

	readonly scopedSearchRouter: lazyAsync<SearchRouter> = lazyMemoized(async () => {
		const { SearchRouter } = await import("../../../mail-app/search/view/SearchRouter.js")
		return new SearchRouter(new ScopedRouter(this.throttledRouter(), "/search"))
	})

	readonly unscopedSearchRouter: lazyAsync<SearchRouter> = lazyMemoized(async () => {
		const { SearchRouter } = await import("../../../mail-app/search/view/SearchRouter.js")
		return new SearchRouter(this.throttledRouter())
	})

	async receivedGroupInvitationsModel<TypeOfGroup extends ShareableGroupType>(groupType: TypeOfGroup): Promise<ReceivedGroupInvitationsModel<TypeOfGroup>> {
		const { ReceivedGroupInvitationsModel } = await import("../../sharing/model/ReceivedGroupInvitationsModel.js")
		return new ReceivedGroupInvitationsModel<TypeOfGroup>(groupType, this.eventController, this.entityClient, this.logins)
	}

	/** This ugly bit exists because CalendarEventWhoModel wants a sync factory. */
	async sendMailModelSyncFactory(mailboxDetails: MailboxDetail, mailboxProperties: MailboxProperties): Promise<() => SendMailModel> {
		const { SendMailModel } = await import("../../mailFunctionality/SendMailModel.js")
		const recipientsModel = await this.recipientsModel()
		const dateProvider = await this.noZoneDateProvider()
		return () =>
			new SendMailModel(
				this.mailFacade,
				this.entityClient,
				this.logins,
				this.mailModel,
				this.contactModel,
				this.eventController,
				mailboxDetails,
				recipientsModel,
				dateProvider,
				mailboxProperties,
			)
	}

	async mailAddressTableModelForOwnMailbox(): Promise<MailAddressTableModel> {
		const { MailAddressTableModel } = await import("../../../mail-app/settings/mailaddress/MailAddressTableModel.js")
		const nameChanger = await this.ownMailAddressNameChanger()
		return new MailAddressTableModel(
			this.entityClient,
			this.serviceExecutor,
			this.mailAddressFacade,
			this.logins,
			this.eventController,
			this.logins.getUserController().userGroupInfo,
			nameChanger,
			await this.redraw(),
		)
	}

	async mailAddressTableModelForAdmin(mailGroupId: Id, userId: Id, userGroupInfo: GroupInfo): Promise<MailAddressTableModel> {
		const { MailAddressTableModel } = await import("../../../mail-app/settings/mailaddress/MailAddressTableModel.js")
		const nameChanger = await this.adminNameChanger(mailGroupId, userId)
		return new MailAddressTableModel(
			this.entityClient,
			this.serviceExecutor,
			this.mailAddressFacade,
			this.logins,
			this.eventController,
			userGroupInfo,
			nameChanger,
			await this.redraw(),
		)
	}

	async ownMailAddressNameChanger(): Promise<MailAddressNameChanger> {
		const { OwnMailAddressNameChanger } = await import("../../../mail-app/settings/mailaddress/OwnMailAddressNameChanger.js")
		return new OwnMailAddressNameChanger(this.mailModel, this.entityClient)
	}

	async adminNameChanger(mailGroupId: Id, userId: Id): Promise<MailAddressNameChanger> {
		const { AnotherUserMailAddressNameChanger } = await import("../../../mail-app/settings/mailaddress/AnotherUserMailAddressNameChanger.js")
		return new AnotherUserMailAddressNameChanger(this.mailAddressFacade, mailGroupId, userId)
	}

	domainConfigProvider(): DomainConfigProvider {
		return new DomainConfigProvider()
	}

	private readonly _workerDeferred: DeferredObject<WorkerClient>
	private _entropyCollector!: EntropyCollector
	private _deferredInitialized: DeferredObject<void> = defer()

	get initialized(): Promise<void> {
		return this._deferredInitialized.promise
	}

	constructor() {
		this._workerDeferred = defer()
	}

	async init(): Promise<void> {
		// Split init in two separate parts: creating modules and causing side effects.
		// We would like to do both on normal init but on HMR we just want to replace modules without a new worker. If we create a new
		// worker we end up losing state on the worker side (including our session).
		this.worker = bootstrapWorker(this)
		await this._createInstances()

		this._deferredInitialized.resolve()
	}

	async _createInstances() {
		const {
			loginFacade,
			customerFacade,
			giftCardFacade,
			groupManagementFacade,
			configFacade,
			calendarFacade,
			mailFacade,
			shareFacade,
			counterFacade,
			indexerFacade,
			searchFacade,
			bookingFacade,
			mailAddressFacade,
			blobFacade,
			userManagementFacade,
			recoverCodeFacade,
			restInterface,
			serviceExecutor,
			cryptoFacade,
			cacheStorage,
			random,
			eventBus,
			entropyFacade,
			workerFacade,
			sqlCipherFacade,
			contactFacade,
		} = this.worker.getWorkerInterface()
		this.loginFacade = loginFacade
		this.customerFacade = customerFacade
		this.giftCardFacade = giftCardFacade
		this.groupManagementFacade = groupManagementFacade
		this.configFacade = configFacade
		this.calendarFacade = calendarFacade
		this.mailFacade = mailFacade
		this.shareFacade = shareFacade
		this.counterFacade = counterFacade
		this.indexerFacade = indexerFacade
		this.searchFacade = searchFacade
		this.bookingFacade = bookingFacade
		this.mailAddressFacade = mailAddressFacade
		this.blobFacade = blobFacade
		this.userManagementFacade = userManagementFacade
		this.recoverCodeFacade = recoverCodeFacade
		this.contactFacade = contactFacade
		this.serviceExecutor = serviceExecutor
		this.sqlCipherFacade = sqlCipherFacade
		this.logins = new LoginController()
		this.eventController = new EventController(locator.logins)
		this.progressTracker = new ProgressTracker()
		this.entityClient = new EntityClient(restInterface)
		this.cryptoFacade = cryptoFacade
		this.cacheStorage = cacheStorage
		this.entropyFacade = entropyFacade
		this.workerFacade = workerFacade
		this.connectivityModel = new WebsocketConnectivityModel(eventBus)
		this.mailModel = new MailModel(notifications, this.eventController, this.mailFacade, this.entityClient, this.logins)
		this.operationProgressTracker = new OperationProgressTracker()

		this.Const = Const
		if (!isBrowser()) {
			const { WebMobileFacade } = await import("../../native/main/WebMobileFacade.js")
			const { WebAuthnFacadeSendDispatcher } = await import("../../native/common/generatedipc/WebAuthnFacadeSendDispatcher.js")
			const { createNativeInterfaces, createDesktopInterfaces } = await import("../../native/main/NativeInterfaceFactory.js")
			this.webMobileFacade = new WebMobileFacade(this.connectivityModel, this.mailModel)
		}

		this.random = random

		this.usageTestModel = new UsageTestModel(
			{
				[StorageBehavior.Persist]: deviceConfig,
				[StorageBehavior.Ephemeral]: new EphemeralUsageTestStorage(),
			},
			{
				now(): number {
					return Date.now()
				},
				timeZone(): string {
					throw new Error("Not implemented by this provider")
				},
			},
			this.serviceExecutor,
			this.entityClient,
			this.logins,
			this.eventController,
			() => this.usageTestController,
		)

		const { ContactModel } = await import("../../contactsFunctionality/ContactModel.js")
		this.contactModel = new ContactModel(this.searchFacade, this.entityClient, this.logins, this.eventController)
		this.usageTestController = new UsageTestController(this.usageTestModel)
	}

	// For testing argon2 migration after login. The production server will reject this request.
	// This can be removed when we enable the migration.
	async changeToBycrypt(passphrase: string): Promise<unknown> {
		const currentUser = this.logins.getUserController().user
		return this.loginFacade.migrateKdfType(KdfType.Bcrypt, passphrase, currentUser)
	}

	async scheduler(): Promise<SchedulerImpl> {
		const dateProvider = await locator.noZoneDateProvider()
		return new SchedulerImpl(dateProvider, window, window)
	}
}

export type IMainLocator = Readonly<MainLocator>

export const locator: IMainLocator = new MainLocator()

if (typeof window !== "undefined") {
	window.tutao.locator = locator
}
