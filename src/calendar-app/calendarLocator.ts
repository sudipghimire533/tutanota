import type { CredentialRemovalHandler } from "../common/login/CredentialRemovalHandler.js"
import { isAndroidApp, isApp, isBrowser, isDesktop, isElectronClient, isIOSApp } from "../common/api/common/Env.js"
import { locator } from "../common/api/main/MainLocator.js"
import { PostLoginActions } from "../common/login/PostLoginActions.js"
import { assertNotNull, lazy, lazyAsync, lazyMemoized, ofClass } from "@tutao/tutanota-utils"
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
import { FeatureType, GroupType } from "../common/api/common/TutanotaConstants.js"
import { CalendarEventModel, CalendarOperation } from "./calendar/gui/eventeditor-model/CalendarEventModel.js"
import type { NativeInterfaceMain } from "../common/native/main/NativeInterfaceMain.js"
import type { NativeFileApp } from "../common/native/common/FileApp.js"
import type { NativePushServiceApp } from "../common/native/main/NativePushServiceApp.js"
import { CommonSystemFacade } from "../common/native/common/generatedipc/CommonSystemFacade.js"
import { ThemeFacade } from "../common/native/common/generatedipc/ThemeFacade.js"
import { MobileSystemFacade } from "../common/native/common/generatedipc/MobileSystemFacade.js"
import { MobileContactsFacade } from "../common/native/common/generatedipc/MobileContactsFacade.js"
import { NativeCredentialsFacade } from "../common/native/common/generatedipc/NativeCredentialsFacade.js"
import { MailboxDetail } from "../common/mailFunctionality/MailModel.js"
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
import { AppHeaderAttrs } from "../common/gui/Header.js"
import { SearchModel } from "../mail-app/search/model/SearchModel.js"
import { SearchViewModel } from "../mail-app/search/view/SearchViewModel.js"
import { InfoMessageHandler } from "../common/gui/InfoMessageHandler.js"
import type { AlarmScheduler } from "./calendar/date/AlarmScheduler.js"
import { DrawerMenuAttrs } from "../common/gui/nav/DrawerMenu.js"
import { SettingsFacade } from "../common/native/common/generatedipc/SettingsFacade.js"
import { DesktopSystemFacade } from "../common/native/common/generatedipc/DesktopSystemFacade.js"
import { SearchBar } from "../mail-app/search/SearchBar.js"

class CalendarLocator {
	private entropyCollector!: EntropyCollector
	private nativeInterfaces: NativeInterfaces | null = null

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

	// Unique to Calendar Locator
	async credentialsRemovalHandler(): Promise<CredentialRemovalHandler> {
		const { NoopCredentialRemovalHandler, AppsCredentialRemovalHandler } = await import("../common/login/CredentialRemovalHandler.js")
		return isBrowser()
			? new NoopCredentialRemovalHandler()
			: new AppsCredentialRemovalHandler(locator.indexerFacade, this.pushService, locator.configFacade, null)
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
		const { CalendarEventsRepository } = await import("./calendar/date/CalendarEventsRepository.js")
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
			import("./calendar/gui/eventeditor-model/CalendarEventModel.js"),
			import("../common/calendarFunctionality/CommonTimeUtils.js"),
			import("./calendar/view/CalendarNotificationSender.js"),
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
		const { getEventType } = await import("./calendar/gui/CalendarGuiUtils.js")
		const { CalendarEventPreviewViewModel } = await import("./calendar/gui/eventpopup/CalendarEventPreviewViewModel.js")

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
		const { AlarmScheduler } = await import("./calendar/date/AlarmScheduler.js")
		const { DefaultDateProvider } = await import("../common/calendarFunctionality/CommonDateUtils.js")
		const dateProvider = new DefaultDateProvider()
		return new AlarmScheduler(dateProvider, await locator.scheduler())
	})

	// **** end of Unique to Calendar Locator

	async init(): Promise<void> {
		// await this.createInstances()
		await this.createInstances()
		//this.deferredInitialized.resolve()

		this.entropyCollector = new EntropyCollector(locator.entropyFacade, await locator.scheduler(), window)

		this.entropyCollector.start()
	}

	async createInstances() {
		this.credentialsProvider = await this.createCredentialsProvider()
		this.secondFactorHandler = new SecondFactorHandler(
			locator.eventController,
			locator.entityClient,
			this.webAuthn,
			locator.loginFacade,
			locator.domainConfigProvider(),
			calendarLocator.secondFactorHandler,
			calendarLocator.credentialsProvider,
		)
		this.loginListener = new PageContextLoginListener(this.secondFactorHandler)
		locator.logins.init(this.loginListener)
		this.search = new SearchModel(locator.searchFacade, () => this.calendarEventsRepository())
		this.searchBar = new SearchBar(this.search)
		this.infoMessageHandler = new InfoMessageHandler(this.search)

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
					return new ReferralLinkNews(this.newsModel, dateProvider, locator.logins.getUserController(), calendarLocator.systemFacade)
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

		if (!isBrowser()) {
			const { CalendarWebCommonNativeFacade } = await import("./native/CalendarWebCommonNativeFacade.js")

			this.nativeInterfaces = createNativeInterfaces(
				locator.webMobileFacade,
				new WebDesktopFacade(calendarLocator.native),
				new WebInterWindowEventFacade(locator.logins, windowFacade, deviceConfig),
				new CalendarWebCommonNativeFacade(),
				locator.cryptoFacade,
				locator.calendarFacade,
				locator.entityClient,
				locator.logins,
			)

			this.fileController =
				this.nativeInterfaces == null
					? new FileControllerBrowser(locator.blobFacade, guiDownload)
					: new FileControllerNative(locator.blobFacade, guiDownload, this.nativeInterfaces.fileApp)
		}

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

		if (this.webAuthn == null) {
			this.webAuthn = new WebauthnClient(
				new BrowserWebauthn(navigator.credentials, locator.domainConfigProvider().getCurrentDomainConfig()),
				locator.domainConfigProvider(),
				isApp(),
			)
		}
	}

	async searchViewModelFactory(): Promise<() => SearchViewModel> {
		const { SearchViewModel } = await import("../mail-app/search/view/SearchViewModel.js")
		// TODO: Fix this when splitting search functionality issue #7155
		// also MailOpenedListener
		//const conversationViewModelFactory = await this.conversationViewModelFactory()
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
				null,
				locator.calendarFacade,
				locator.progressTracker,
				null,
				redraw,
				deviceConfig.getMailAutoSelectBehavior(),
				calendarLocator.calendarModel,
			)
		}
	}

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
				locator.webMobileFacade,
				null,
				this.systemFacade,
				this.credentialsProvider,
				null,
				deviceConfig,
				calendarLocator.pushService,
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
			return new CredentialsProvider(this.nativeCredentialsFacade, locator.sqlCipherFacade, isDesktop() ? this.interWindowEventSender : null)
		} else {
			const { WebCredentialsFacade } = await import("../common/misc/credentials/WebCredentialsFacade.js")
			return new CredentialsProvider(new WebCredentialsFacade(deviceConfig), null, null)
		}
	}

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
}

export type ICalendarLocator = Readonly<CalendarLocator>

export const calendarLocator: ICalendarLocator = new CalendarLocator()
