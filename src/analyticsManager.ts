/* eslint-disable no-mixed-spaces-and-tabs */

import db, { COLLECTIONS } from "./firestoreConfig";

import { Timestamp } from 'firebase-admin/firestore';

type EventType = "STATUS_REPORT";

export interface AnalyticsEvent {
    type: EventType;
    appId: string;
    identifier: string;
    groupId: string;
    data: Record<string, unknown>;
    timestamp?: Timestamp;
}

class AnalyticsManager {
	sendEvent(event: AnalyticsEvent): void {
		db.collection(COLLECTIONS.EVENTS.name).add({
			...event,
			timestamp: Timestamp.fromDate(new Date()),
		});
	}
}

export default AnalyticsManager;
