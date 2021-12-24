/* eslint-disable no-mixed-spaces-and-tabs */

import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import { cert, initializeApp } from 'firebase-admin/app';

import { Guid } from '@microsoft/mixed-reality-extension-sdk';
import { ServiceAccount } from 'firebase-admin';
import serviceAccount from './esalademo-firebase-adminsdk-xn3iv-02f56257c9.json';

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

class UserManager {
	async isUserPermitted(id: Guid, name: string): Promise<boolean> {
		let matchProperty: MatchProperty = MatchProperty.ID;

		const [matchPropertyDoc, permittedUsersSnapshot] = 
            await Promise.all([
            	db.collection(SETTINGS).doc(PROPERTY_TO_MATCH).get(), 
            	db.collection(PERMITTED_USERS).get(),
            ]);

		if (matchPropertyDoc?.exists) {
			matchProperty = (matchPropertyDoc?.data()?.value as MatchProperty) || MatchProperty.ID;
		}

		let foundId = false;
		let foundName = false;
		permittedUsersSnapshot.forEach((document) => {
			const data = document.data();
			if (data?.id === id as unknown as string) {
				foundId = true;
			}
			if (data?.name === name) {
				foundName = true;
			}
		});
		return matchProperty === MatchProperty.ID ? foundId : foundName;
	}

	async insertUnauthorizedUser(id: Guid, name: string): Promise<void> {
		await db.collection(UNAUTHORIZED_USERS).add({
			id: id as unknown as string,
			name,
			timestamp: Timestamp.fromDate(new Date()),
		});
	}
}

export default new UserManager();
