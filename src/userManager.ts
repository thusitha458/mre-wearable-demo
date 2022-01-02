/* eslint-disable no-mixed-spaces-and-tabs */

import db, { COLLECTIONS } from './firestoreConfig';

import { Guid } from '@microsoft/mixed-reality-extension-sdk';
import { PermissionStatus } from './types';
import { Timestamp } from 'firebase-admin/firestore';

enum MatchProperty {
    ID = "id",
    NAME = "name",
}

class UserManager {
	private matchProperty: MatchProperty;

	constructor() {
		// eslint-disable-next-line no-console
		this.initializeSettings().catch((error) => console.error(error));
	}

	private initializeSettings = async (): Promise<void> => {
		const matchPropertyDoc = await db
			.collection(COLLECTIONS.SETTINGS.name)
			.doc(COLLECTIONS.SETTINGS.properties.PROPERTY_TO_MATCH.name)
			.get();
		if (matchPropertyDoc?.exists) {
			this.matchProperty = (matchPropertyDoc?.data()?.value as MatchProperty) || MatchProperty.NAME;
		}
	}

	async isUserPermitted(appId: string, id: Guid, name: string): Promise<PermissionStatus> {

		const permittedUsersSnapshot = 
            await db
				.collection(COLLECTIONS.PERMITTED_USERS.name)
				.where(COLLECTIONS.PERMITTED_USERS.properties.APP_ID.name, "==", appId)
				.get();

		let foundId = false;
		let foundName = false;
		let permittedResourcesForIdMatch: string[] = [];
		let permittedResourcesForNameMatch: string[] = [];

		permittedUsersSnapshot.forEach((document) => {
			const data = document.data();
			if (data?.id === id as unknown as string) {
				foundId = true;
				permittedResourcesForIdMatch = (data?.permittedResources as string[]) || [];
			}
			if (data?.name === name) {
				foundName = true;
				permittedResourcesForNameMatch = (data?.permittedResources as string[]) || [];
			}
		});
		
		return {
			permitted: this.matchProperty === MatchProperty.ID ? foundId : foundName,
			permittedResources: this.matchProperty === MatchProperty.ID
				? permittedResourcesForIdMatch
				: permittedResourcesForNameMatch,
		};
	}

	async insertUnauthorizedUser(appId: string, id: Guid, name: string): Promise<void> {
		await db.collection(COLLECTIONS.UNAUTHORIZED_USERS.name).add({
			id: id as unknown as string,
			name,
			timestamp: Timestamp.fromDate(new Date()),
			appId,
		});
	}
}

export default UserManager;
