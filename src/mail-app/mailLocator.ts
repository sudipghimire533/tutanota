import { assertMainOrNode, isAndroidApp, isApp, isBrowser, isDesktop, isElectronClient, isIOSApp } from "../common/api/common/Env.js"
import { MinimizedMailEditorViewModel } from "./mail/model/MinimizedMailEditorViewModel"
// we want to move MailAddressNameChanger, MailAddressTableModel but need to make settings descisions
import type { CreateMailViewerOptions } from "./mail/view/MailViewer.js"
import type { MailViewerViewModel } from "./mail/view/MailViewerViewModel.js"
import type { ExternalLoginViewModel } from "../common/login/ExternalLoginView.js"
import type { ConversationViewModel, ConversationViewModelFactory } from "./mail/view/ConversationViewModel.js"
import { NativeContactsSyncManager } from "./contacts/model/NativeContactsSyncManager.js"
import { MailOpenedListener } from "./mail/view/MailViewModel.js"
import { InboxRuleHandler } from "./mail/model/InboxRuleHandler.js"
import { CalendarEvent, CalendarEventAttendee, Mail, type MailboxProperties } from "../common/api/entities/tutanota/TypeRefs.js"
import { getDisplayedSender, getEnabledMailAddressesWithUser } from "../common/mailFunctionality/CommonMailUtils.js"
import { ContactImporter } from "./contacts/ContactImporter.js"
import { AddNotificationEmailDialog } from "./settings/AddNotificationEmailDialog.js"
import { assert, assertNotNull, lazy, lazyAsync, lazyMemoized, noOp, ofClass } from "@tutao/tutanota-utils"
import { deviceConfig } from "../common/misc/DeviceConfig.js"
import { locator } from "../common/api/main/MainLocator.js"
import { ScopedRouter } from "../common/gui/ScopedRouter.js"
import type { CredentialRemovalHandler } from "../common/login/CredentialRemovalHandler.js"
import { FeatureType, GroupType } from "../common/api/common/TutanotaConstants.js"
import { PostLoginActions } from "../common/login/PostLoginActions.js"
import { SearchModel } from "./search/model/SearchModel.js"
import { CredentialsProvider } from "../common/misc/credentials/CredentialsProvider.js"
import { FileController, guiDownload } from "../common/file/FileController.js"
import { SecondFactorHandler } from "../common/misc/2fa/SecondFactorHandler.js"
import { WebauthnClient } from "../common/misc/2fa/webauthn/WebauthnClient.js"
import { NewsModel } from "../common/misc/news/NewsModel.js"
import { SearchTextInAppFacade } from "../common/native/common/generatedipc/SearchTextInAppFacade.js"
import { SettingsFacade } from "../common/native/common/generatedipc/SettingsFacade.js"
import { DesktopSystemFacade } from "../common/native/common/generatedipc/DesktopSystemFacade.js"
import { SystemPermissionHandler } from "../common/native/main/SystemPermissionHandler.js"
import { InterWindowEventFacadeSendDispatcher } from "../common/native/common/generatedipc/InterWindowEventFacadeSendDispatcher.js"
import { PageContextLoginListener } from "../common/api/main/PageContextLoginListener.js"
import { InfoMessageHandler } from "../common/gui/InfoMessageHandler.js"
import { OfflineIndicatorViewModel } from "../common/gui/base/OfflineIndicatorViewModel.js"
import { DrawerMenuAttrs } from "../common/gui/nav/DrawerMenu.js"
import { createDesktopInterfaces, createNativeInterfaces, NativeInterfaces } from "../common/native/main/NativeInterfaceFactory.js"
import { AppHeaderAttrs } from "../common/gui/Header.js"
import { SearchViewModel } from "./search/view/SearchViewModel.js"
import { RecipientsSearchModel } from "../common/misc/RecipientsSearchModel.js"
import { CredentialFormatMigrator } from "../common/misc/credentials/CredentialFormatMigrator.js"
import { windowFacade } from "../common/misc/WindowFacade.js"
import { ProgrammingError } from "../common/api/common/error/ProgrammingError.js"
import { WebAuthnFacadeSendDispatcher } from "../common/native/common/generatedipc/WebAuthnFacadeSendDispatcher.js"
import { BrowserWebauthn } from "../common/misc/2fa/webauthn/BrowserWebauthn.js"
import { FileControllerBrowser } from "../common/file/FileControllerBrowser.js"
import { FileControllerNative } from "../common/file/FileControllerNative.js"
import { EntropyCollector } from "../common/api/main/EntropyCollector.js"
import { PermissionError } from "../common/api/common/error/PermissionError.js"
import { NativeInterfaceMain } from "../common/native/main/NativeInterfaceMain.js"
import { NativeFileApp } from "../common/native/common/FileApp.js"
import { NativePushServiceApp } from "../common/native/main/NativePushServiceApp.js"
import { CommonSystemFacade } from "../common/native/common/generatedipc/CommonSystemFacade.js"
import { ThemeFacade } from "../common/native/common/generatedipc/ThemeFacade.js"
import { MobileSystemFacade } from "../common/native/common/generatedipc/MobileSystemFacade.js"
import { MobileContactsFacade } from "../common/native/common/generatedipc/MobileContactsFacade.js"
import { NativeCredentialsFacade } from "../common/native/common/generatedipc/NativeCredentialsFacade.js"
import { LoginViewModel } from "../common/login/LoginViewModel.js"
import { CalendarViewModel } from "../calendar-app/calendar/view/CalendarViewModel.js"
import { CalendarEventModel, CalendarOperation } from "../calendar-app/calendar/gui/eventeditor-model/CalendarEventModel.js"
import { CalendarEventsRepository } from "../calendar-app/calendar/date/CalendarEventsRepository.js"
import { MailboxDetail } from "../common/mailFunctionality/MailModel.js"
import { showProgressDialog } from "../common/gui/dialogs/ProgressDialog.js"
import type { CalendarInfo, CalendarModel } from "../common/calendarFunctionality/CalendarModel.js"
import type { CalendarEventPreviewViewModel } from "../calendar-app/calendar/gui/eventpopup/CalendarEventPreviewViewModel.js"
import { isCustomizationEnabledForCustomer } from "../common/api/common/utils/CustomerUtils.js"
import { notifications } from "../common/gui/Notifications.js"
import { CalendarInviteHandler } from "../calendar-app/calendar/view/CalendarInvites.js"
import type { AlarmScheduler } from "../calendar-app/calendar/date/AlarmScheduler.js"

assertMainOrNode()

class MailLocator {
	private nativeInterfaces: NativeInterfaces | null = null
	private entropyCollector!: EntropyCollector
	minimizedMailModel!: MinimizedMailEditorViewModel

	search!: SearchModel
	credentialsProvider!: CredentialsProvider
	fileController!: FileController
	secondFactorHandler!: SecondFactorHandler
	webAuthn!: WebauthnClient
	newsModel!: NewsModel
	searchTextFacade!: SearchTextInAppFacade
	desktopSettingsFacade!: SettingsFacade
	desktopSystemFacade!: DesktopSystemFacade
	systemPermissionHandler!: SystemPermissionHandler
	interWindowEventSender!: InterWindowEventFacadeSendDispatcher
	loginListener!: PageContextLoginListener
	infoMessageHandler!: InfoMessageHandler

	async createInstances() {
		this.minimizedMailModel = new MinimizedMailEditorViewModel()
		// TODO: remove calendar events repository from mailLocator when splitting search
		this.search = new SearchModel(locator.searchFacade, async () => null)
		this.infoMessageHandler = new InfoMessageHandler(this.search)

		if (!isBrowser()) {
			const { WebDesktopFacade } = await import("../common/native/main/WebDesktopFacade")
			const { MailWebCommonNativeFacade } = await import("./native/MailWebCommonNativeFacade.js")
			const { WebInterWindowEventFacade } = await import("../common/native/main/WebInterWindowEventFacade.js")
			this.nativeInterfaces = createNativeInterfaces(
				locator.webMobileFacade,
				new WebDesktopFacade(),
				new WebInterWindowEventFacade(locator.logins, windowFacade, deviceConfig),
				new MailWebCommonNativeFacade(),
				locator.cryptoFacade,
				locator.calendarFacade,
				locator.entityClient,
				locator.logins,
			)

			if (isElectronClient()) {
				const desktopInterfaces = createDesktopInterfaces(this.native)
				this.searchTextFacade = desktopInterfaces.searchTextFacade
				this.interWindowEventSender = desktopInterfaces.interWindowEventSender
				this.webAuthn = new WebauthnClient(new WebAuthnFacadeSendDispatcher(this.native), locator.domainConfigProvider(), isApp())
				if (isDesktop()) {
					this.desktopSettingsFacade = desktopInterfaces.desktopSettingsFacade
					this.desktopSystemFacade = desktopInterfaces.desktopSystemFacade
				}
			} else if (isAndroidApp() || isIOSApp()) {
				const { SystemPermissionHandler } = await import("../common/native/main/SystemPermissionHandler.js")
				this.systemPermissionHandler = new SystemPermissionHandler(this.systemFacade)
				this.webAuthn = new WebauthnClient(new WebAuthnFacadeSendDispatcher(this.native), locator.domainConfigProvider(), isApp())
			}
		}

		if (this.webAuthn == null) {
			this.webAuthn = new WebauthnClient(
				new BrowserWebauthn(navigator.credentials, locator.domainConfigProvider().getCurrentDomainConfig()),
				locator.domainConfigProvider(),
				isApp(),
			)
		}
		this.secondFactorHandler = new SecondFactorHandler(
			locator.eventController,
			locator.entityClient,
			this.webAuthn,
			locator.loginFacade,
			locator.domainConfigProvider(),
		)
		this.loginListener = new PageContextLoginListener(this.secondFactorHandler)
		this.credentialsProvider = await this.createCredentialsProvider()

		this.newsModel = new NewsModel(locator.serviceExecutor, deviceConfig, async (name: string) => {
			switch (name) {
				case "usageOptIn":
					const { UsageOptInNews } = await import("../common/misc/news/items/UsageOptInNews.js")
					return new UsageOptInNews(this.newsModel, locator.usageTestModel)
				case "recoveryCode":
					const { RecoveryCodeNews } = await import("../common/misc/news/items/RecoveryCodeNews.js")
					return new RecoveryCodeNews(this.newsModel, locator.logins.getUserController(), locator.recoverCodeFacade)
				case "pinBiometrics":
					const { PinBiometricsNews } = await import("../common/misc/news/items/PinBiometricsNews.js")
					return new PinBiometricsNews(this.newsModel, this.credentialsProvider, locator.logins.getUserController().userId)
				case "referralLink":
					const { ReferralLinkNews } = await import("../common/misc/news/items/ReferralLinkNews.js")
					const dateProvider = await locator.noZoneDateProvider()
					return new ReferralLinkNews(this.newsModel, dateProvider, locator.logins.getUserController())
				case "newPlans":
					const { NewPlansNews } = await import("../common/misc/news/items/NewPlansNews.js")
					return new NewPlansNews(this.newsModel, locator.logins.getUserController())
				case "newPlansOfferEnding":
					const { NewPlansOfferEndingNews } = await import("../common/misc/news/items/NewPlansOfferEndingNews.js")
					return new NewPlansOfferEndingNews(this.newsModel, locator.logins.getUserController())
				default:
					console.log(`No implementation for news named '${name}'`)
					return null
			}
		})

		this.fileController =
			this.nativeInterfaces == null
				? new FileControllerBrowser(locator.blobFacade, guiDownload)
				: new FileControllerNative(locator.blobFacade, guiDownload, this.nativeInterfaces.fileApp)
	}

	async init(): Promise<void> {
		await this.createInstances()

		this.entropyCollector = new EntropyCollector(locator.entropyFacade, await locator.scheduler(), window)
		this.entropyCollector.start()

		//this.deferredInitialized.resolve()
	}

	// Unique to Mail Locator
	readonly conversationViewModelFactory: lazyAsync<ConversationViewModelFactory> = async () => {
		const { ConversationViewModel } = await import("./mail/view/ConversationViewModel.js")
		const factory = await this.mailViewerViewModelFactory()
		const m = await import("mithril")
		return (options: CreateMailViewerOptions) => {
			return new ConversationViewModel(
				options,
				(options) => factory(options),
				locator.entityClient,
				locator.eventController,
				deviceConfig,
				locator.mailModel,
				m.redraw,
			)
		}
	}

	async conversationViewModel(options: CreateMailViewerOptions): Promise<ConversationViewModel> {
		const factory = await this.conversationViewModelFactory()
		return factory(options)
	}

	contactImporter = async (): Promise<ContactImporter> => {
		const { ContactImporter } = await import("./contacts/ContactImporter.js")
		return new ContactImporter(locator.contactFacade, this.systemPermissionHandler)
	}

	async mailViewerViewModelFactory(): Promise<(options: CreateMailViewerOptions) => MailViewerViewModel> {
		const { MailViewerViewModel } = await import("./mail/view/MailViewerViewModel.js")
		return ({ mail, showFolder }) =>
			new MailViewerViewModel(
				mail,
				showFolder,
				locator.entityClient,
				locator.mailModel,
				locator.contactModel,
				locator.configFacade,
				this.fileController,
				locator.logins,
				async (mailboxDetails) => {
					const mailboxProperties = await locator.mailModel.getMailboxProperties(mailboxDetails.mailboxGroupRoot)
					return locator.sendMailModel(mailboxDetails, mailboxProperties)
				},
				locator.eventController,
				locator.workerFacade,
				this.search,
				locator.mailFacade,
				locator.cryptoFacade,
				() => this.contactImporter(),
			)
	}

	async externalLoginViewModelFactory(): Promise<() => ExternalLoginViewModel> {
		const { ExternalLoginViewModel } = await import("../common/login/ExternalLoginView.js")
		return () => new ExternalLoginViewModel(this.credentialsProvider)
	}

	readonly mailViewModel = lazyMemoized(async () => {
		const { MailViewModel } = await import("./mail/view/MailViewModel.js")
		const conversationViewModelFactory = await this.conversationViewModelFactory()
		const router = new ScopedRouter(locator.throttledRouter(), "/mail")
		return new MailViewModel(
			locator.mailModel,
			locator.entityClient,
			locator.eventController,
			locator.connectivityModel,
			locator.cacheStorage,
			conversationViewModelFactory,
			this.mailOpenedListener,
			deviceConfig,
			this.inboxRuleHanlder(),
			router,
			await locator.redraw(),
		)
	})

	readonly nativeContactsSyncManager = lazyMemoized(() => {
		assert(isApp(), "isApp")
		return new NativeContactsSyncManager(
			locator.logins,
			this.mobileContactsFacade,
			locator.entityClient,
			locator.eventController,
			locator.contactModel,
			deviceConfig,
		)
	})

	async credentialsRemovalHandler(): Promise<CredentialRemovalHandler> {
		const { NoopCredentialRemovalHandler, AppsCredentialRemovalHandler } = await import("../common/login/CredentialRemovalHandler.js")
		return isBrowser()
			? new NoopCredentialRemovalHandler()
			: new AppsCredentialRemovalHandler(locator.indexerFacade, this.pushService, locator.configFacade, isApp() ? this.nativeContactsSyncManager() : null)
	}

	readonly mailOpenedListener: MailOpenedListener = {
		onEmailOpened: isDesktop()
			? (mail: Mail) => {
					this.desktopSystemFacade.sendSocketMessage(getDisplayedSender(mail).address)
			  }
			: noOp,
	}

	inboxRuleHanlder(): InboxRuleHandler {
		return new InboxRuleHandler(locator.mailFacade, locator.entityClient, locator.logins)
	}

	async addNotificationEmailDialog(): Promise<AddNotificationEmailDialog> {
		const { AddNotificationEmailDialog } = await import("./settings/AddNotificationEmailDialog.js")
		return new AddNotificationEmailDialog(locator.logins, locator.entityClient)
	}

	readonly contactViewModel = lazyMemoized(async () => {
		const { ContactViewModel } = await import("./contacts/view/ContactViewModel.js")
		const router = new ScopedRouter(locator.throttledRouter(), "/contact")
		return new ContactViewModel(locator.contactModel, locator.entityClient, locator.eventController, router, await locator.redraw())
	})

	readonly contactListViewModel = lazyMemoized(async () => {
		const { ContactListViewModel } = await import("./contacts/view/ContactListViewModel.js")
		const router = new ScopedRouter(locator.throttledRouter(), "/contactlist")
		return new ContactListViewModel(
			locator.entityClient,
			locator.groupManagementFacade,
			locator.logins,
			locator.eventController,
			locator.contactModel,
			await locator.receivedGroupInvitationsModel(GroupType.ContactList),
			router,
			await locator.redraw(),
		)
	})

	appPartialLoginSuccessActions = () => {
		// don't wait for it, just invoke
		this.fileApp.clearFileData().catch((e) => console.log("Failed to clean file data", e))
		this.nativeContactsSyncManager()?.syncContacts()
	}
	// **** end of Unique to Mail Locator

	postLoginActions: () => Promise<PostLoginActions> = lazyMemoized(async () => {
		const { PostLoginActions } = await import("../common/login/PostLoginActions")
		return new PostLoginActions(
			this.credentialsProvider,
			this.secondFactorHandler,
			locator.connectivityModel,
			locator.logins,
			await locator.noZoneDateProvider(),
			locator.entityClient,
			locator.userManagementFacade,
			locator.customerFacade,
			() => this.showSetupWizard(),
			() => this.appPartialLoginSuccessActions(),
		)
	})

	readonly offlineIndicatorViewModel = lazyMemoized(async () => {
		return new OfflineIndicatorViewModel(
			locator.cacheStorage,
			this.loginListener,
			locator.connectivityModel,
			locator.logins,
			locator.progressTracker,
			await locator.redraw(),
		)
	})

	async appHeaderAttrs(): Promise<AppHeaderAttrs> {
		return {
			offlineIndicatorModel: await this.offlineIndicatorViewModel(),
			newsModel: this.newsModel,
		}
	}

	async searchViewModelFactory(): Promise<() => SearchViewModel> {
		const { SearchViewModel } = await import("./search/view/SearchViewModel.js")
		const conversationViewModelFactory = await this.conversationViewModelFactory()
		const redraw = await locator.redraw()
		const searchRouter = await locator.scopedSearchRouter()
		return () => {
			return new SearchViewModel(
				searchRouter,
				this.search,
				locator.searchFacade,
				locator.mailModel,
				locator.logins,
				locator.indexerFacade,
				locator.entityClient,
				locator.eventController,
				this.mailOpenedListener,
				locator.calendarFacade,
				locator.progressTracker,
				conversationViewModelFactory,
				redraw,
				deviceConfig.getMailAutoSelectBehavior(),
			)
		}
	}

	async recipientsSearchModel(): Promise<RecipientsSearchModel> {
		const { RecipientsSearchModel } = await import("../common/misc/RecipientsSearchModel.js")
		const suggestionsProvider = isApp()
			? (query: string) => this.mobileContactsFacade.findSuggestions(query).catch(ofClass(PermissionError, () => []))
			: null
		return new RecipientsSearchModel(await locator.recipientsModel(), locator.contactModel, suggestionsProvider, locator.entityClient)
	}

	get native(): NativeInterfaceMain {
		return this.getNativeInterface("native")
	}

	get fileApp(): NativeFileApp {
		return this.getNativeInterface("fileApp")
	}

	get pushService(): NativePushServiceApp {
		return this.getNativeInterface("pushService")
	}

	get commonSystemFacade(): CommonSystemFacade {
		return this.getNativeInterface("commonSystemFacade")
	}

	get themeFacade(): ThemeFacade {
		return this.getNativeInterface("themeFacade")
	}

	get systemFacade(): MobileSystemFacade {
		return this.getNativeInterface("mobileSystemFacade")
	}

	get mobileContactsFacade(): MobileContactsFacade {
		return this.getNativeInterface("mobileContactsFacade")
	}

	get nativeCredentialsFacade(): NativeCredentialsFacade {
		return this.getNativeInterface("nativeCredentialsFacade")
	}

	async drawerAttrsFactory(): Promise<() => DrawerMenuAttrs> {
		return () => ({
			logins: locator.logins,
			newsModel: this.newsModel,
			desktopSystemFacade: this.desktopSystemFacade,
		})
	}

	async loginViewModelFactory(): Promise<lazy<LoginViewModel>> {
		const { LoginViewModel } = await import("../common/login/LoginViewModel.js")
		const { MobileAppLock, NoOpAppLock } = await import("../common/login/AppLock.js")
		const appLock = isApp()
			? new MobileAppLock(assertNotNull(this.nativeInterfaces).mobileSystemFacade, assertNotNull(this.nativeInterfaces).nativeCredentialsFacade)
			: new NoOpAppLock()
		return () => {
			const domainConfig = isBrowser()
				? locator.domainConfigProvider().getDomainConfigForHostname(location.hostname, location.protocol, location.port)
				: // in this case, we know that we have a staticUrl set that we need to use
				  locator.domainConfigProvider().getCurrentDomainConfig()

			return new LoginViewModel(
				locator.logins,
				this.credentialsProvider,
				this.secondFactorHandler,
				deviceConfig,
				domainConfig,
				isBrowser() ? null : this.pushService,
				appLock,
			)
		}
	}

	private getNativeInterface<T extends keyof NativeInterfaces>(name: T): NativeInterfaces[T] {
		if (!this.nativeInterfaces) {
			throw new ProgrammingError(`Tried to use ${name} in web`)
		}

		return this.nativeInterfaces[name]
	}

	showSetupWizard = async () => {
		if (isApp()) {
			const { showSetupWizard } = await import("../common/native/main/wizard/SetupWizard.js")
			// TODO: fix in setup wizard story #7150, handle nativeContactSyncManager and contactImporter in mailLocator
			return showSetupWizard(this.systemPermissionHandler, locator.webMobileFacade, null, this.systemFacade, this.credentialsProvider, null, deviceConfig)
		}
	}
	readonly credentialFormatMigrator: () => Promise<CredentialFormatMigrator> = lazyMemoized(async () => {
		const { CredentialFormatMigrator } = await import("../common/misc/credentials/CredentialFormatMigrator.js")
		if (isDesktop()) {
			return new CredentialFormatMigrator(deviceConfig, this.nativeCredentialsFacade, null)
		} else if (isApp()) {
			return new CredentialFormatMigrator(deviceConfig, this.nativeCredentialsFacade, this.systemFacade)
		} else {
			return new CredentialFormatMigrator(deviceConfig, null, null)
		}
	})

	/**
	 * Factory method for credentials provider that will return an instance injected with the implementations appropriate for the platform.
	 */
	private async createCredentialsProvider(): Promise<CredentialsProvider> {
		const { CredentialsProvider } = await import("../common/misc/credentials/CredentialsProvider.js")
		if (isDesktop() || isApp()) {
			return new CredentialsProvider(this.nativeCredentialsFacade, locator.sqlCipherFacade, isDesktop() ? this.interWindowEventSender : null)
		} else {
			const { WebCredentialsFacade } = await import("../common/misc/credentials/WebCredentialsFacade.js")
			return new CredentialsProvider(new WebCredentialsFacade(deviceConfig), null, null)
		}
	}

	// ** Calendar things, we need them here until we split better
	readonly calendarViewModel = lazyMemoized<Promise<CalendarViewModel>>(async () => {
		const { CalendarViewModel } = await import("../calendar-app/calendar/view/CalendarViewModel.js")
		const { DefaultDateProvider } = await import("../common/calendarFunctionality/CommonDateUtils.js")
		const timeZone = new DefaultDateProvider().timeZone()
		return new CalendarViewModel(
			locator.logins,
			async (mode: CalendarOperation, event: CalendarEvent) => {
				const mailboxDetail = await locator.mailModel.getUserMailboxDetails()
				const mailboxProperties = await locator.mailModel.getMailboxProperties(mailboxDetail.mailboxGroupRoot)
				return await this.calendarEventModel(mode, event, mailboxDetail, mailboxProperties, null)
			},
			(...args) => this.calendarEventPreviewModel(...args),
			await this.calendarModel(),
			await this.calendarEventsRepository(),
			locator.entityClient,
			locator.eventController,
			locator.progressTracker,
			deviceConfig,
			await locator.receivedGroupInvitationsModel(GroupType.Calendar),
			timeZone,
			locator.mailModel,
		)
	})

	readonly calendarEventsRepository: lazyAsync<CalendarEventsRepository> = lazyMemoized(async () => {
		const { CalendarEventsRepository } = await import("../calendar-app/calendar/date/CalendarEventsRepository.js")
		const { DefaultDateProvider } = await import("../common/calendarFunctionality/CommonDateUtils.js")
		const timeZone = new DefaultDateProvider().timeZone()
		return new CalendarEventsRepository(await this.calendarModel(), locator.calendarFacade, timeZone, locator.entityClient, locator.eventController)
	})

	async calendarEventModel(
		editMode: CalendarOperation,
		event: Partial<CalendarEvent>,
		mailboxDetail: MailboxDetail,
		mailboxProperties: MailboxProperties,
		responseTo: Mail | null,
	): Promise<CalendarEventModel | null> {
		const [{ makeCalendarEventModel }, { getTimeZone }, { calendarNotificationSender }] = await Promise.all([
			import("../calendar-app/calendar/gui/eventeditor-model/CalendarEventModel.js"),
			import("../common/calendarFunctionality/CommonTimeUtils.js"),
			import("../calendar-app/calendar/view/CalendarNotificationSender.js"),
		])
		const sendMailModelFactory = await locator.sendMailModelSyncFactory(mailboxDetail, mailboxProperties)
		const showProgress = <T>(p: Promise<T>) => showProgressDialog("pleaseWait_msg", p)

		return await makeCalendarEventModel(
			editMode,
			event,
			await locator.recipientsModel(),
			await this.calendarModel(),
			locator.logins,
			mailboxDetail,
			mailboxProperties,
			sendMailModelFactory,
			calendarNotificationSender,
			locator.entityClient,
			responseTo,
			getTimeZone(),
			showProgress,
		)
	}

	async calendarEventPreviewModel(selectedEvent: CalendarEvent, calendars: ReadonlyMap<string, CalendarInfo>): Promise<CalendarEventPreviewViewModel> {
		const { findAttendeeInAddresses } = await import("../common/calendarFunctionality/CommonCalendarUtils.js")
		const { getEventType } = await import("../calendar-app/calendar/gui/CalendarGuiUtils.js")
		const { CalendarEventPreviewViewModel } = await import("../calendar-app/calendar/gui/eventpopup/CalendarEventPreviewViewModel.js")

		const mailboxDetails = await locator.mailModel.getUserMailboxDetails()

		const mailboxProperties = await locator.mailModel.getMailboxProperties(mailboxDetails.mailboxGroupRoot)

		const userController = locator.logins.getUserController()
		const customer = await userController.loadCustomer()
		const ownMailAddresses = getEnabledMailAddressesWithUser(mailboxDetails, userController.userGroupInfo)
		const ownAttendee: CalendarEventAttendee | null = findAttendeeInAddresses(selectedEvent.attendees, ownMailAddresses)
		const eventType = getEventType(selectedEvent, calendars, ownMailAddresses, userController.user)
		const hasBusinessFeature = isCustomizationEnabledForCustomer(customer, FeatureType.BusinessFeatureEnabled) || (await userController.isNewPaidPlan())
		const lazyIndexEntry = async () => (selectedEvent.uid != null ? locator.calendarFacade.getEventsByUid(selectedEvent.uid) : null)
		const popupModel = new CalendarEventPreviewViewModel(
			selectedEvent,
			await this.calendarModel(),
			eventType,
			hasBusinessFeature,
			ownAttendee,
			lazyIndexEntry,
			async (mode: CalendarOperation) => this.calendarEventModel(mode, selectedEvent, mailboxDetails, mailboxProperties, null),
		)

		// If we have a preview model we want to display the description
		// so makes sense to already sanitize it after building the event
		await popupModel.sanitizeDescription()

		return popupModel
	}

	readonly calendarModel: () => Promise<CalendarModel> = lazyMemoized(async () => {
		const { DefaultDateProvider } = await import("../common/calendarFunctionality/CommonDateUtils.js")
		const { CalendarModel } = await import("../common/calendarFunctionality/CalendarModel.js")
		const timeZone = new DefaultDateProvider().timeZone()
		return new CalendarModel(
			notifications,
			this.alarmScheduler,
			locator.eventController,
			locator.serviceExecutor,
			locator.logins,
			locator.progressTracker,
			locator.entityClient,
			locator.mailModel,
			locator.calendarFacade,
			this.fileController,
			timeZone,
		)
	})

	readonly calendarInviteHandler: () => Promise<CalendarInviteHandler> = lazyMemoized(async () => {
		const { CalendarInviteHandler } = await import("../calendar-app/calendar/view/CalendarInvites.js")
		const { calendarNotificationSender } = await import("../calendar-app/calendar/view/CalendarNotificationSender.js")
		return new CalendarInviteHandler(locator.mailModel, await this.calendarModel(), locator.logins, calendarNotificationSender, (...arg) =>
			locator.sendMailModel(...arg),
		)
	})

	alarmScheduler: () => Promise<AlarmScheduler> = lazyMemoized(async () => {
		const { AlarmScheduler } = await import("../calendar-app/calendar/date/AlarmScheduler.js")
		const { DefaultDateProvider } = await import("../common/calendarFunctionality/CommonDateUtils.js")
		const dateProvider = new DefaultDateProvider()
		return new AlarmScheduler(dateProvider, await locator.scheduler())
	})
	// **** end of Unique to Calendar Locator
}

export type IMailLocator = Readonly<MailLocator>

export const mailLocator: IMailLocator = new MailLocator()
