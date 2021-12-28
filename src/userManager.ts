/* eslint-disable no-mixed-spaces-and-tabs */

import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import { cert, initializeApp } from 'firebase-admin/app';

import { Guid } from '@microsoft/mixed-reality-extension-sdk';
import { ServiceAccount } from 'firebase-admin';
import serviceAccount from './esalademo-firebase-adminsdk-xn3iv-02f56257c9.json';

interface PermissionStatus {
	permitted: boolean;
	permittedResources: string[];
}

initializeApp({
	credential: cert(serviceAccount as ServiceAccount),
});

const db = getFirestore();

enum MatchProperty {
    ID = "id",
    NAME = "name",
}

// collections
const SETTINGS = "settings";
const PERMITTED_USERS = "permitted-users";
const UNAUTHORIZED_USERS = "unauthorized-users";

// properties
const PROPERTY_TO_MATCH = "propertyToMatch";
const APP_ID = "appId";

class UserManager {
	private matchProperty: MatchProperty;

	constructor() {
		// eslint-disable-next-line no-console
		this.initializeSettings().catch((error) => console.error(error));
	}

	private initializeSettings = async (): Promise<void> => {
		const matchPropertyDoc = await db.collection(SETTINGS).doc(PROPERTY_TO_MATCH).get();
		if (matchPropertyDoc?.exists) {
			this.matchProperty = (matchPropertyDoc?.data()?.value as MatchProperty) || MatchProperty.NAME;
		}
	}

	async isUserPermitted(appId: string, id: Guid, name: string): Promise<PermissionStatus> {

		const permittedUsersSnapshot = 
            await db.collection(PERMITTED_USERS).where(APP_ID, "==", appId).get();

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
			permittedResources: this.matchProperty === MatchProperty.ID ? permittedResourcesForIdMatch : permittedResourcesForNameMatch,
		};
	}

	async insertUnauthorizedUser(appId: string, id: Guid, name: string): Promise<void> {
		await db.collection(UNAUTHORIZED_USERS).add({
			id: id as unknown as string,
			name,
			timestamp: Timestamp.fromDate(new Date()),
			appId,
		});
	}
}

export default new UserManager();
