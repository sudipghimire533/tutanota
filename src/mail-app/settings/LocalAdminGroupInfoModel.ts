import m from "mithril"
import type { GroupInfo } from "../../common/api/entities/sys/TypeRefs.js"
import { GroupInfoTypeRef } from "../../common/api/entities/sys/TypeRefs.js"
import { locator } from "../../common/api/main/CommonLocator"

import { noOp, promiseMap } from "@tutao/tutanota-utils"
import { EntityUpdateData, isUpdateForTypeRef } from "../../common/api/common/utils/EntityUpdateUtils.js"

class LocalAdminGroupInfoModel {
	_initialization: Promise<GroupInfo[]> | null
	groupInfos: GroupInfo[]

	constructor() {
		this._initialization = null
		this.groupInfos = []
	}

	init(): Promise<GroupInfo[]> {
		if (this._initialization) {
			return this._initialization
		}

		locator.eventController.addEntityListener((updates) => {
			return promiseMap(updates, (update) => {
				return this.entityEventReceived(update)
			}).then(noOp)
		})
		return this._init()
	}

	_init(): Promise<GroupInfo[]> {
		this._initialization = locator.logins
			.getUserController()
			.loadCustomer()
			.then(async (customer) => {
				this.groupInfos = await locator.entityClient.loadAll(GroupInfoTypeRef, customer.teamGroups)
				return this.groupInfos
			})
		return this._initialization
	}

	entityEventReceived<T>(update: EntityUpdateData): Promise<void> {
		if (isUpdateForTypeRef(GroupInfoTypeRef, update)) {
			return this._init().then(() => m.redraw())
		} else {
			return Promise.resolve()
		}
	}
}

export const localAdminGroupInfoModel: LocalAdminGroupInfoModel = new LocalAdminGroupInfoModel()
