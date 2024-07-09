import type { CredentialRemovalHandler } from "../common/login/CredentialRemovalHandler.js"
import { assertMainOrNode, isAndroidApp, isApp, isBrowser, isDesktop, isElectronClient, isIOSApp } from "../common/api/common/Env.js"
import { PostLoginActions } from "../common/login/PostLoginActions.js"
import { assertNotNull, defer, DeferredObject, lazy, lazyAsync, lazyMemoized, ofClass } from "@tutao/tutanota-utils"
import { windowFacade } from "../common/misc/WindowFacade.js"
import { deviceConfig } from "../common/misc/DeviceConfig.js"
import { WebDesktopFacade } from "../common/native/main/WebDesktopFacade.js"
import { WebInterWindowEventFacade } from "../common/native/main/WebInterWindowEventFacade.js"
import { createDesktopInterfaces, createNativeInterfaces, type NativeInterfaces } from "../common/native/main/NativeInterfaceFactory.js"
import { LoginViewModel } from "../common/login/LoginViewModel.js"
import { ProgrammingError } from "../common/api/common/error/ProgrammingError.js"
import { FileController, guiDownload } from "../common/file/FileController.js"
import { FileControllerBrowser } from "../common/file/FileControllerBrowser.js"
import { FileControllerNative } from "../common/file/FileControllerNative.js"
import type { CalendarInfo, CalendarModel } from "../common/calendarFunctionality/CalendarModel.js"
import { notifications } from "../common/gui/Notifications.js"
import { CalendarInviteHandler } from "./calendar/view/CalendarInvites.js"
import { CalendarEvent, CalendarEventAttendee, type Mail, type MailboxProperties } from "../common/api/entities/tutanota/TypeRefs.js"
import type { CalendarEventPreviewViewModel } from "./calendar/gui/eventpopup/CalendarEventPreviewViewModel.js"
import { getEnabledMailAddressesWithUser } from "../common/mailFunctionality/CommonMailUtils.js"
import { isCustomizationEnabledForCustomer } from "../common/api/common/utils/CustomerUtils.js"
import { Const, FeatureType, GroupType, KdfType } from "../common/api/common/TutanotaConstants.js"
import { CalendarEventModel, CalendarOperation } from "./calendar/gui/eventeditor-model/CalendarEventModel.js"
import type { NativeInterfaceMain } from "../common/native/main/NativeInterfaceMain.js"
import type { NativeFileApp } from "../common/native/common/FileApp.js"
import type { NativePushServiceApp } from "../common/native/main/NativePushServiceApp.js"
import { CommonSystemFacade } from "../common/native/common/generatedipc/CommonSystemFacade.js"
import { ThemeFacade } from "../common/native/common/generatedipc/ThemeFacade.js"
import { MobileSystemFacade } from "../common/native/common/generatedipc/MobileSystemFacade.js"
import { MobileContactsFacade } from "../common/native/common/generatedipc/MobileContactsFacade.js"
import { NativeCredentialsFacade } from "../common/native/common/generatedipc/NativeCredentialsFacade.js"
import { MailboxDetail, MailModel } from "../common/mailFunctionality/MailModel.js"
import { showProgressDialog } from "../common/gui/dialogs/ProgressDialog.js"
import type { RecipientsSearchModel } from "../common/misc/RecipientsSearchModel.js"
import { PermissionError } from "../common/api/common/error/PermissionError.js"
import { CalendarEventsRepository } from "./calendar/date/CalendarEventsRepository.js"
import { CalendarViewModel } from "./calendar/view/CalendarViewModel.js"
import { EntropyCollector } from "../common/api/main/EntropyCollector.js"
import { CredentialFormatMigrator } from "../common/misc/credentials/CredentialFormatMigrator.js"
import { CredentialsProvider } from "../common/misc/credentials/CredentialsProvider.js"
import { WebauthnClient } from "../common/misc/2fa/webauthn/WebauthnClient.js"
import { WebAuthnFacadeSendDispatcher } from "../common/native/common/generatedipc/WebAuthnFacadeSendDispatcher.js"
import { SearchTextInAppFacade } from "../common/native/common/generatedipc/SearchTextInAppFacade.js"
import { InterWindowEventFacadeSendDispatcher } from "../common/native/common/generatedipc/InterWindowEventFacadeSendDispatcher.js"
import { SystemPermissionHandler } from "../common/native/main/SystemPermissionHandler.js"
import { BrowserWebauthn } from "../common/misc/2fa/webauthn/BrowserWebauthn.js"
import { SecondFactorHandler } from "../common/misc/2fa/SecondFactorHandler.js"
import { PageContextLoginListener } from "../common/api/main/PageContextLoginListener.js"
import { NewsModel } from "../common/misc/news/NewsModel.js"
import { OfflineIndicatorViewModel } from "../common/gui/base/OfflineIndicatorViewModel.js"
import { AppHeaderAttrs, Header } from "../common/gui/Header.js"
import { SearchModel } from "../mail-app/search/model/SearchModel.js"
import { SearchViewModel } from "../mail-app/search/view/SearchViewModel.js"
import { InfoMessageHandler } from "../common/gui/InfoMessageHandler.js"
import type { AlarmScheduler } from "./calendar/date/AlarmScheduler.js"
import { DrawerMenuAttrs } from "../common/gui/nav/DrawerMenu.js"
import { SettingsFacade } from "../common/native/common/generatedipc/SettingsFacade.js"
import { DesktopSystemFacade } from "../common/native/common/generatedipc/DesktopSystemFacade.js"
import { SearchBar } from "../mail-app/search/SearchBar.js"
import { bootstrapWorker, WorkerClient } from "../common/api/main/WorkerClient.js"
import { EntityClient } from "../common/api/common/EntityClient.js"
import { WebsocketConnectivityModel } from "../common/misc/WebsocketConnectivityModel.js"
import { EventController } from "../common/api/main/EventController.js"
import type { ContactModel } from "../common/contactsFunctionality/ContactModel.js"
import { ProgressTracker } from "../common/api/main/ProgressTracker.js"
import type { LoginFacade } from "../common/api/worker/facades/LoginFacade.js"
import { LoginController } from "../common/api/main/LoginController.js"
import type { CustomerFacade } from "../common/api/worker/facades/lazy/CustomerFacade.js"
import type { GiftCardFacade } from "../common/api/worker/facades/lazy/GiftCardFacade.js"
import type { GroupManagementFacade } from "../common/api/worker/facades/lazy/GroupManagementFacade.js"
import type { ConfigurationDatabase } from "../common/api/worker/facades/lazy/ConfigurationDatabase.js"
import type { CalendarFacade } from "../common/api/worker/facades/lazy/CalendarFacade.js"
import type { MailFacade } from "../common/api/worker/facades/lazy/MailFacade.js"
import type { ShareFacade } from "../common/api/worker/facades/lazy/ShareFacade.js"
import type { CounterFacade } from "../common/api/worker/facades/lazy/CounterFacade.js"
import type { Indexer } from "../common/api/worker/search/Indexer.js"
import type { SearchFacade } from "../common/api/worker/search/SearchFacade.js"
import type { BookingFacade } from "../common/api/worker/facades/lazy/BookingFacade.js"
import type { MailAddressFacade } from "../common/api/worker/facades/lazy/MailAddressFacade.js"
import type { BlobFacade } from "../common/api/worker/facades/lazy/BlobFacade.js"
import type { UserManagementFacade } from "../common/api/worker/facades/lazy/UserManagementFacade.js"
import { RecoverCodeFacade } from "../common/api/worker/facades/lazy/RecoverCodeFacade.js"
import { ContactFacade } from "../common/api/worker/facades/lazy/ContactFacade.js"
import { UsageTestController } from "@tutao/tutanota-usagetests"
import { EphemeralUsageTestStorage, StorageBehavior, UsageTestModel } from "../common/misc/UsageTestModel.js"
import { IServiceExecutor } from "../common/api/common/ServiceRequest.js"
import { CryptoFacade } from "../common/api/worker/crypto/CryptoFacade.js"
import { WebMobileFacade } from "../common/native/main/WebMobileFacade.js"
import { ExposedCacheStorage } from "../common/api/worker/rest/DefaultEntityRestCache.js"
import { WorkerFacade } from "../common/api/worker/facades/WorkerFacade.js"
import { WorkerRandomizer } from "../common/api/worker/WorkerImpl.js"
import { OperationProgressTracker } from "../common/api/main/OperationProgressTracker.js"
import { EntropyFacade } from "../common/api/worker/facades/EntropyFacade.js"
import { SqlCipherFacade } from "../common/native/common/generatedipc/SqlCipherFacade.js"
import { MailAddressNameChanger, MailAddressTableModel } from "../mail-app/settings/mailaddress/MailAddressTableModel.js"
import { SchedulerImpl } from "../common/api/common/utils/Scheduler.js"
import { DomainConfigProvider } from "../common/api/common/DomainConfigProvider.js"
import { RecipientsModel } from "../common/api/main/RecipientsModel.js"
import { NoZoneDateProvider } from "../common/api/common/utils/NoZoneDateProvider.js"
import type { SendMailModel } from "../common/mailFunctionality/SendMailModel.js"
import { Router, ScopedRouter, ThrottledRouter } from "../common/gui/ScopedRouter.js"
import { SearchRouter } from "../mail-app/search/view/SearchRouter.js"
import { ShareableGroupType } from "../common/sharing/GroupUtils.js"
import { ReceivedGroupInvitationsModel } from "../common/sharing/model/ReceivedGroupInvitationsModel.js"
import { GroupInfo } from "../common/api/entities/sys/TypeRefs.js"

assertMainOrNode()

class CalendarLocator {
	private entropyCollector!: EntropyCollector
	private nativeInterfaces: NativeInterfaces | null = null

	worker!: WorkerClient
	fileController!: FileController
	credentialsProvider!: CredentialsProvider
	searchTextFacade!: SearchTextInAppFacade
	interWindowEventSender!: InterWindowEventFacadeSendDispatcher
	webAuthn!: WebauthnClient
	systemPermissionHandler!: SystemPermissionHandler
	secondFactorHandler!: SecondFactorHandler
	loginListener!: PageContextLoginListener
	newsModel!: NewsModel
	search!: SearchModel
	searchBar!: SearchBar
	infoMessageHandler!: InfoMessageHandler
	desktopSettingsFacade!: SettingsFacade
	desktopSystemFacade!: DesktopSystemFacade

	entropyFacade!: EntropyFacade
	sqlCipherFacade!: SqlCipherFacade
	entityClient!: EntityClient
	loginFacade!: LoginFacade
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
	serviceExecutor!: IServiceExecutor
	cryptoFacade!: CryptoFacade
	cacheStorage!: ExposedCacheStorage
	workerFacade!: WorkerFacade
	random!: WorkerRandomizer
	connectivityModel!: WebsocketConnectivityModel

	mailModel!: MailModel
	eventController!: EventController
	contactModel!: ContactModel
	progressTracker!: ProgressTracker
	logins!: LoginController
	header!: Header
	usageTestController!: UsageTestController
	usageTestModel!: UsageTestModel
	webMobileFacade!: WebMobileFacade
	operationProgressTracker!: OperationProgressTracker
	Const!: Record<string, any>

	private readonly workerDeferred: DeferredObject<WorkerClient>
	private deferredInitialized: DeferredObject<void> = defer()

	get initialized(): Promise<void> {
		return this.deferredInitialized.promise
	}

	constructor() {
		this.workerDeferred = defer()
	}

	async init(): Promise<void> {
		// Split init in two separate parts: creating modules and causing side effects.
		// We would like to do both on normal init but on HMR we just want to replace modules without a new worker. If we create a new
		// worker we end up losing state on the worker side (including our session).
		this.worker = bootstrapWorker(this)
		await this.createInstances()

		this.entropyCollector = new EntropyCollector(this.entropyFacade, await this.scheduler(), window)
		this.entropyCollector.start()

		this.deferredInitialized.resolve()
	}

	// Unique to Calendar Locator
	async credentialsRemovalHandler(): Promise<CredentialRemovalHandler> {
		const { NoopCredentialRemovalHandler, AppsCredentialRemovalHandler } = await import("../common/login/CredentialRemovalHandler.js")
		return isBrowser()
			? new NoopCredentialRemovalHandler()
			: new AppsCredentialRemovalHandler(this.indexerFacade, this.pushService, this.configFacade, null)
	}

	appPartialLoginSuccessActions = () => {
		// don't wait for it, just invoke
		this.fileApp.clearFileData().catch((e) => console.log("Failed to clean file data", e))
	}

	readonly calendarViewModel = lazyMemoized<Promise<CalendarViewModel>>(async () => {
		const { CalendarViewModel } = await import("./calendar/view/CalendarViewModel.js")
		const { DefaultDateProvider } = await import("../common/calendarFunctionality/CommonDateUtils.js")
		const timeZone = new DefaultDateProvider().timeZone()
		return new CalendarViewModel(
			this.logins,
			async (mode: CalendarOperation, event: CalendarEvent) => {
				const mailboxDetail = await this.mailModel.getUserMailboxDetails()
				const mailboxProperties = await this.mailModel.getMailboxProperties(mailboxDetail.mailboxGroupRoot)
				return await this.calendarEventModel(mode, event, mailboxDetail, mailboxProperties, null)
			},
			(...args) => this.calendarEventPreviewModel(...args),
			await this.calendarModel(),
			await this.calendarEventsRepository(),
			this.entityClient,
			this.eventController,
			this.progressTracker,
			deviceConfig,
			await this.receivedGroupInvitationsModel(GroupType.Calendar),
			timeZone,
			this.mailModel,
		)
	})

	readonly calendarEventsRepository: lazyAsync<CalendarEventsRepository> = lazyMemoized(async () => {
		const { CalendarEventsRepository } = await import("./calendar/date/CalendarEventsRepository.js")
		const { DefaultDateProvider } = await import("../common/calendarFunctionality/CommonDateUtils.js")
		const timeZone = new DefaultDateProvider().timeZone()
		return new CalendarEventsRepository(await this.calendarModel(), this.calendarFacade, timeZone, this.entityClient, this.eventController)
	})

	async calendarEventModel(
		editMode: CalendarOperation,
		event: Partial<CalendarEvent>,
		mailboxDetail: MailboxDetail,
		mailboxProperties: MailboxProperties,
		responseTo: Mail | null,
	): Promise<CalendarEventModel | null> {
		const [{ makeCalendarEventModel }, { getTimeZone }, { calendarNotificationSender }] = await Promise.all([
			import("./calendar/gui/eventeditor-model/CalendarEventModel.js"),
			import("../common/calendarFunctionality/CommonTimeUtils.js"),
			import("./calendar/view/CalendarNotificationSender.js"),
		])
		const sendMailModelFactory = await this.sendMailModelSyncFactory(mailboxDetail, mailboxProperties)
		const showProgress = <T>(p: Promise<T>) => showProgressDialog("pleaseWait_msg", p)

		return await makeCalendarEventModel(
			editMode,
			event,
			await this.recipientsModel(),
			await this.calendarModel(),
			this.logins,
			mailboxDetail,
			mailboxProperties,
			sendMailModelFactory,
			calendarNotificationSender,
			this.entityClient,
			responseTo,
			getTimeZone(),
			showProgress,
		)
	}

	async calendarEventPreviewModel(selectedEvent: CalendarEvent, calendars: ReadonlyMap<string, CalendarInfo>): Promise<CalendarEventPreviewViewModel> {
		const { findAttendeeInAddresses } = await import("../common/calendarFunctionality/CommonCalendarUtils.js")
		const { getEventType } = await import("./calendar/gui/CalendarGuiUtils.js")
		const { CalendarEventPreviewViewModel } = await import("./calendar/gui/eventpopup/CalendarEventPreviewViewModel.js")

		const mailboxDetails = await this.mailModel.getUserMailboxDetails()

		const mailboxProperties = await this.mailModel.getMailboxProperties(mailboxDetails.mailboxGroupRoot)

		const userController = this.logins.getUserController()
		const customer = await userController.loadCustomer()
		const ownMailAddresses = getEnabledMailAddressesWithUser(mailboxDetails, userController.userGroupInfo)
		const ownAttendee: CalendarEventAttendee | null = findAttendeeInAddresses(selectedEvent.attendees, ownMailAddresses)
		const eventType = getEventType(selectedEvent, calendars, ownMailAddresses, userController.user)
		const hasBusinessFeature = isCustomizationEnabledForCustomer(customer, FeatureType.BusinessFeatureEnabled) || (await userController.isNewPaidPlan())
		const lazyIndexEntry = async () => (selectedEvent.uid != null ? this.calendarFacade.getEventsByUid(selectedEvent.uid) : null)
		const popupModel = new CalendarEventPreviewViewModel(
			selectedEvent,
			await this.calendarModel(),
			eventType,
			hasBusinessFeature,
			ownAttendee,
			lazyIndexEntry,
			async (mode: CalendarOperation) => this.calendarEventModel(mode, selectedEvent, mailboxDetails, mailboxProperties, null),
			this.recipientsSearchModel,
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
			this.eventController,
			this.serviceExecutor,
			this.logins,
			this.progressTracker,
			this.entityClient,
			this.mailModel,
			this.calendarFacade,
			this.fileController,
			timeZone,
		)
	})

	readonly calendarInviteHandler: () => Promise<CalendarInviteHandler> = lazyMemoized(async () => {
		const { CalendarInviteHandler } = await import("../calendar-app/calendar/view/CalendarInvites.js")
		const { calendarNotificationSender } = await import("../calendar-app/calendar/view/CalendarNotificationSender.js")
		return new CalendarInviteHandler(this.mailModel, await this.calendarModel(), this.logins, calendarNotificationSender, (...arg) =>
			this.sendMailModel(...arg),
		)
	})

	alarmScheduler: () => Promise<AlarmScheduler> = lazyMemoized(async () => {
		const { AlarmScheduler } = await import("./calendar/date/AlarmScheduler.js")
		const { DefaultDateProvider } = await import("../common/calendarFunctionality/CommonDateUtils.js")
		const dateProvider = new DefaultDateProvider()
		return new AlarmScheduler(dateProvider, await this.scheduler())
	})

	// **** end of Unique to Calendar Locator

	async createInstances() {
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
		this.entityClient = new EntityClient(restInterface)
		this.cryptoFacade = cryptoFacade
		this.cacheStorage = cacheStorage
		this.entropyFacade = entropyFacade
		this.workerFacade = workerFacade
		this.connectivityModel = new WebsocketConnectivityModel(eventBus)
		this.random = random

		this.credentialsProvider = await this.createCredentialsProvider()
		this.secondFactorHandler = new SecondFactorHandler(
			this.eventController,
			this.entityClient,
			this.webAuthn,
			this.loginFacade,
			this.domainConfigProvider(),
			this.credentialsProvider,
		)
		this.loginListener = new PageContextLoginListener(this.secondFactorHandler)
		this.search = new SearchModel(this.searchFacade, () => this.calendarEventsRepository())
		this.searchBar = new SearchBar()
		this.infoMessageHandler = new InfoMessageHandler(this.search)

		this.logins = new LoginController(this.loginListener, this.loginFacade)
		this.eventController = new EventController(this.logins)
		this.progressTracker = new ProgressTracker()
		this.mailModel = new MailModel(notifications, this.eventController, this.mailFacade, this.entityClient, this.logins)
		this.operationProgressTracker = new OperationProgressTracker()

		this.Const = Const

		this.newsModel = new NewsModel(this.serviceExecutor, deviceConfig, async (name: string) => {
			switch (name) {
				case "usageOptIn":
					const { UsageOptInNews } = await import("../common/misc/news/items/UsageOptInNews.js")
					return new UsageOptInNews(this.newsModel, this.usageTestModel)
				case "recoveryCode":
					const { RecoveryCodeNews } = await import("../common/misc/news/items/RecoveryCodeNews.js")
					return new RecoveryCodeNews(this.newsModel, this.logins.getUserController(), this.recoverCodeFacade)
				case "pinBiometrics":
					const { PinBiometricsNews } = await import("../common/misc/news/items/PinBiometricsNews.js")
					return new PinBiometricsNews(this.newsModel, this.credentialsProvider, this.logins.getUserController().userId)
				case "referralLink":
					const { ReferralLinkNews } = await import("../common/misc/news/items/ReferralLinkNews.js")
					const dateProvider = await this.noZoneDateProvider()
					return new ReferralLinkNews(this.newsModel, dateProvider, this.logins.getUserController(), this.systemFacade)
				case "newPlans":
					const { NewPlansNews } = await import("../common/misc/news/items/NewPlansNews.js")
					return new NewPlansNews(this.newsModel, this.logins.getUserController())
				case "newPlansOfferEnding":
					const { NewPlansOfferEndingNews } = await import("../common/misc/news/items/NewPlansOfferEndingNews.js")
					return new NewPlansOfferEndingNews(this.newsModel, this.logins.getUserController())
				default:
					console.log(`No implementation for news named '${name}'`)
					return null
			}
		})

		if (!isBrowser()) {
			const { CalendarWebCommonNativeFacade } = await import("./native/CalendarWebCommonNativeFacade.js")
			const { WebMobileFacade } = await import("../common/native/main/WebMobileFacade.js")
			const { WebAuthnFacadeSendDispatcher } = await import("../common/native/common/generatedipc/WebAuthnFacadeSendDispatcher.js")
			const { createNativeInterfaces, createDesktopInterfaces } = await import("../common/native/main/NativeInterfaceFactory.js")
			this.webMobileFacade = new WebMobileFacade(this.connectivityModel, this.mailModel)

			this.nativeInterfaces = createNativeInterfaces(
				this.webMobileFacade,
				new WebDesktopFacade(this.native),
				new WebInterWindowEventFacade(this.logins, windowFacade, deviceConfig),
				new CalendarWebCommonNativeFacade(),
				this.cryptoFacade,
				this.calendarFacade,
				this.entityClient,
				this.logins,
			)

			this.fileController =
				this.nativeInterfaces == null
					? new FileControllerBrowser(this.blobFacade, guiDownload)
					: new FileControllerNative(this.blobFacade, guiDownload, this.nativeInterfaces.fileApp)
		}

		if (isElectronClient()) {
			const desktopInterfaces = createDesktopInterfaces(this.native)
			this.searchTextFacade = desktopInterfaces.searchTextFacade
			this.interWindowEventSender = desktopInterfaces.interWindowEventSender
			this.webAuthn = new WebauthnClient(new WebAuthnFacadeSendDispatcher(this.native), this.domainConfigProvider(), isApp())
			if (isDesktop()) {
				this.desktopSettingsFacade = desktopInterfaces.desktopSettingsFacade
				this.desktopSystemFacade = desktopInterfaces.desktopSystemFacade
			}
		} else if (isAndroidApp() || isIOSApp()) {
			const { SystemPermissionHandler } = await import("../common/native/main/SystemPermissionHandler.js")
			this.systemPermissionHandler = new SystemPermissionHandler(this.systemFacade)
			this.webAuthn = new WebauthnClient(new WebAuthnFacadeSendDispatcher(this.native), this.domainConfigProvider(), isApp())
		}

		if (this.webAuthn == null) {
			this.webAuthn = new WebauthnClient(
				new BrowserWebauthn(navigator.credentials, this.domainConfigProvider().getCurrentDomainConfig()),
				this.domainConfigProvider(),
				isApp(),
			)
		}

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

		const { ContactModel } = await import("../common/contactsFunctionality/ContactModel.js")
		this.contactModel = new ContactModel(this.searchFacade, this.entityClient, this.logins, this.eventController)
		this.usageTestController = new UsageTestController(this.usageTestModel)
	}

	async searchViewModelFactory(): Promise<() => SearchViewModel> {
		const { SearchViewModel } = await import("../mail-app/search/view/SearchViewModel.js")
		// TODO: Fix this when splitting search functionality issue #7155
		// also MailOpenedListener
		//const conversationViewModelFactory = await this.conversationViewModelFactory()
		const redraw = await this.redraw()
		const searchRouter = await this.scopedSearchRouter()
		return () => {
			return new SearchViewModel(
				searchRouter,
				this.search,
				this.searchFacade,
				this.mailModel,
				this.logins,
				this.indexerFacade,
				this.entityClient,
				this.eventController,
				null,
				this.calendarFacade,
				this.progressTracker,
				null,
				redraw,
				deviceConfig.getMailAutoSelectBehavior(),
				this.calendarModel,
			)
		}
	}

	postLoginActions: () => Promise<PostLoginActions> = lazyMemoized(async () => {
		const { PostLoginActions } = await import("../common/login/PostLoginActions")
		return new PostLoginActions(
			this.credentialsProvider,
			this.secondFactorHandler,
			this.connectivityModel,
			this.logins,
			await this.noZoneDateProvider(),
			this.entityClient,
			this.userManagementFacade,
			this.customerFacade,
			() => this.showSetupWizard(),
			() => this.appPartialLoginSuccessActions(),
			this.calendarModel,
			this.pushService,
			this.newsModel,
		)
	})

	async loginViewModelFactory(): Promise<lazy<LoginViewModel>> {
		const { LoginViewModel } = await import("../common/login/LoginViewModel.js")
		const { MobileAppLock, NoOpAppLock } = await import("../common/login/AppLock.js")
		const appLock = isApp()
			? new MobileAppLock(assertNotNull(this.nativeInterfaces).mobileSystemFacade, assertNotNull(this.nativeInterfaces).nativeCredentialsFacade)
			: new NoOpAppLock()
		return () => {
			const domainConfig = isBrowser()
				? this.domainConfigProvider().getDomainConfigForHostname(location.hostname, location.protocol, location.port)
				: // in this case, we know that we have a staticUrl set that we need to use
				  this.domainConfigProvider().getCurrentDomainConfig()

			return new LoginViewModel(
				this.logins,
				this.credentialsProvider,
				this.secondFactorHandler,
				deviceConfig,
				domainConfig,
				isBrowser() ? null : this.pushService,
				appLock,
			)
		}
	}

	async recipientsSearchModel(): Promise<RecipientsSearchModel> {
		const { RecipientsSearchModel } = await import("../common/misc/RecipientsSearchModel.js")
		const suggestionsProvider = isApp()
			? (query: string) => this.mobileContactsFacade.findSuggestions(query).catch(ofClass(PermissionError, () => []))
			: null
		return new RecipientsSearchModel(await this.recipientsModel(), this.contactModel, suggestionsProvider, this.entityClient)
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
			logins: this.logins,
			newsModel: this.newsModel,
			desktopSystemFacade: this.desktopSystemFacade,
		})
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
			return showSetupWizard(
				this.systemPermissionHandler,
				this.webMobileFacade,
				null,
				this.systemFacade,
				this.credentialsProvider,
				null,
				deviceConfig,
				this.pushService,
			)
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
			return new CredentialsProvider(this.nativeCredentialsFacade, this.sqlCipherFacade, isDesktop() ? this.interWindowEventSender : null)
		} else {
			const { WebCredentialsFacade } = await import("../common/misc/credentials/WebCredentialsFacade.js")
			return new CredentialsProvider(new WebCredentialsFacade(deviceConfig), null, null)
		}
	}

	readonly offlineIndicatorViewModel = lazyMemoized(async () => {
		return new OfflineIndicatorViewModel(
			this.cacheStorage,
			this.loginListener,
			this.connectivityModel,
			this.logins,
			this.progressTracker,
			await this.redraw(),
		)
	})

	async appHeaderAttrs(): Promise<AppHeaderAttrs> {
		return {
			offlineIndicatorModel: await this.offlineIndicatorViewModel(),
			newsModel: this.newsModel,
		}
	}

	// Re-evaluate if needed later

	async ownMailAddressNameChanger(): Promise<MailAddressNameChanger> {
		const { OwnMailAddressNameChanger } = await import("../mail-app/settings/mailaddress/OwnMailAddressNameChanger.js")
		return new OwnMailAddressNameChanger(this.mailModel, this.entityClient)
	}

	async adminNameChanger(mailGroupId: Id, userId: Id): Promise<MailAddressNameChanger> {
		const { AnotherUserMailAddressNameChanger } = await import("../mail-app/settings/mailaddress/AnotherUserMailAddressNameChanger.js")
		return new AnotherUserMailAddressNameChanger(this.mailAddressFacade, mailGroupId, userId)
	}

	// For testing argon2 migration after login. The production server will reject this request.
	// This can be removed when we enable the migration.
	async changeToBycrypt(passphrase: string): Promise<unknown> {
		const currentUser = this.logins.getUserController().user
		return this.loginFacade.migrateKdfType(KdfType.Bcrypt, passphrase, currentUser)
	}

	async scheduler(): Promise<SchedulerImpl> {
		const dateProvider = await this.noZoneDateProvider()
		return new SchedulerImpl(dateProvider, window, window)
	}

	domainConfigProvider(): DomainConfigProvider {
		return new DomainConfigProvider()
	}

	/** This ugly bit exists because CalendarEventWhoModel wants a sync factory. */
	async sendMailModelSyncFactory(mailboxDetails: MailboxDetail, mailboxProperties: MailboxProperties): Promise<() => SendMailModel> {
		const { SendMailModel } = await import("../common/mailFunctionality/SendMailModel.js")
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
		const { MailAddressTableModel } = await import("../mail-app/settings/mailaddress/MailAddressTableModel.js")
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
		const { MailAddressTableModel } = await import("../mail-app/settings/mailaddress/MailAddressTableModel.js")
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

	readonly recipientsModel: lazyAsync<RecipientsModel> = lazyMemoized(async () => {
		const { RecipientsModel } = await import("../common/api/main/RecipientsModel.js")
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
		const { SearchRouter } = await import("../mail-app/search/view/SearchRouter.js")
		return new SearchRouter(new ScopedRouter(this.throttledRouter(), "/search"))
	})

	readonly unscopedSearchRouter: lazyAsync<SearchRouter> = lazyMemoized(async () => {
		const { SearchRouter } = await import("../mail-app/search/view/SearchRouter.js")
		return new SearchRouter(this.throttledRouter())
	})

	async receivedGroupInvitationsModel<TypeOfGroup extends ShareableGroupType>(groupType: TypeOfGroup): Promise<ReceivedGroupInvitationsModel<TypeOfGroup>> {
		const { ReceivedGroupInvitationsModel } = await import("../common/sharing/model/ReceivedGroupInvitationsModel.js")
		return new ReceivedGroupInvitationsModel<TypeOfGroup>(groupType, this.eventController, this.entityClient, this.logins)
	}
}

export type ICalendarLocator = Readonly<CalendarLocator>

export const calendarLocator: ICalendarLocator = new CalendarLocator()

if (typeof window !== "undefined") {
	window.tutao.locator = calendarLocator
}
