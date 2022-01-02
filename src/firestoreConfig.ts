import { cert, initializeApp } from 'firebase-admin/app';

import { ServiceAccount } from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccount.json';

export const COLLECTIONS = {
	SETTINGS: {
		name: "settings",
		properties: {
			PROPERTY_TO_MATCH: {
				name: "propertyToMatch",
			}
		}
	},
	PERMITTED_USERS: {
		name: "permitted-users",
		properties: {
			APP_ID: {
				name: "appId",
			},
		}
	},
	UNAUTHORIZED_USERS: {
		name: "unauthorized-users",
	},
	EVENTS: {
		name: "events",
	},
};

initializeApp({
	credential: cert(serviceAccount as ServiceAccount),
});

export default getFirestore();
