/* eslint-disable max-len */
/* eslint-disable no-console */
/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import * as MRE from '@microsoft/mixed-reality-extension-sdk';

import userManager from './userManager';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fetch = require('node-fetch');

const CLEAR_BUTTON_ID = "__CLEAR_BUTTON__";
const CLEAR_BUTTON_RESOURCE_ID = "artifact:1150513214480450500";

const DEFAULT_APP_ID = "__DEFAULT_APP__";

const handleNameConflictsInContentPacks = true;

type ItemDescriptor = {
	resourceId: string;
	scale?: {
		x: number;
		y: number;
		z: number;
	};
	rotation?: {
		x: number;
		y: number;
		z: number;
	};
	position?: {
		x: number;
		y: number;
		z: number;
	};
	menuScale?: {
		x: number;
		y: number;
		z: number;
	};
	menuRotation?: {
		x: number;
		y: number;
		z: number;
	};
	menuPosition?: {
		x: number;
		y: number;
		z: number;
	};
	attachPoint?: MRE.AttachPoint;
};

type ItemDatabase = Record<string, ItemDescriptor>;

const controls: Record<string, ItemDescriptor> = { [CLEAR_BUTTON_ID]: { resourceId: CLEAR_BUTTON_RESOURCE_ID }};

export default class WearAnItem {
	private currentAppId: string;
	private assets: MRE.AssetContainer;
	private contentPacks: string[];
	// Container for instantiated items.
	private attachedItems = new Map<MRE.Guid, MRE.Actor>();
	private openedMenus = new Map<MRE.Guid, MRE.Actor>();

	// Load the database of items.
	private itemDatabase: ItemDatabase = Object.assign(
		{},
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		require('../public/default-content-pack.json'),
		controls,
	);

	/**
	 * Constructs a new instance of this class.
	 * @param context The MRE SDK context.
	 * @param baseUrl The baseUrl to this project's `./public` folder.
	 */
	constructor(private context: MRE.Context, private params: MRE.ParameterSet) {
		this.assets = new MRE.AssetContainer(context);
		this.currentAppId = params?.app_id && Array.isArray(params?.app_id) ?
			params?.app_id?.[0] : (params?.app_id ? params?.app_id as string : DEFAULT_APP_ID);

		this.contentPacks = params?.content_packs && Array.isArray(params?.content_packs) ?
			params?.content_packs : (params?.content_packs ? [params?.content_packs] as string[] : []);
		
		// Hook the context events we're interested in.
		this.context.onStarted(() => this.started());
		this.context.onUserLeft(user => this.userLeft(user));
	}

	/**
	 * Called when an application session starts up.
	 */
	private async started() {
		// Check whether code is running in a debuggable watched filesystem
		// environment and if so delay starting the app by 1 second to give
		// the debugger time to detect that the server has restarted and reconnect.
		// The delay value below is in milliseconds so 1000 is a one second delay.
		// You may need to increase the delay or be able to decrease it depending
		// on the speed of your PC.
		const delay = 1000;
		const argv = process.execArgv.join();
		const isDebug = argv.includes('inspect') || argv.includes('debug');

		// // version to use with non-async code
		// if (isDebug) {
		// 	setTimeout(this.startedImpl, delay);
		// } else {
		// 	this.startedImpl();
		// }

		// version to use with async code
		if (isDebug) {
			await new Promise(resolve => setTimeout(resolve, delay));
			await this.startedImpl();
		} else {
			await this.startedImpl();
		}
	}

	// use () => {} syntax here to get proper scope binding when called via setTimeout()
	// if async is required, next line becomes private startedImpl = async () => {
	private startedImpl = async () => {
		await this.populateDatabase();
		// Show the logo button which opens the menu.
		this.showLogoButton();
	}

	private async populateDatabase(): Promise<void> {
		if (this.contentPacks.length > 0) {
			const contentPackData = await Promise.all(this.contentPacks.map(this.loadContentPack));
			this.itemDatabase = Object.assign({}, ...[...contentPackData, controls]);
		}
	}

	private loadContentPack = async (contentPackId: string): Promise<Record<string, ItemDescriptor>> => {
		const response = await fetch(`https://account.altvr.com/api/content_packs/${contentPackId}/raw.json`);
		const data = await response.json() as Record<string, ItemDescriptor>;

		if (handleNameConflictsInContentPacks) {
			return Object.keys(data)
				.reduce((updated, key) => {
					updated[`${contentPackId}_${key}`] = data[key];
					return updated;
				}, {} as Record<string, ItemDescriptor>);
		}

		return data;
	}

	/**
	 * Called when a user leaves the application (probably left the Altspace world where this app is running).
	 * @param user The user that left the building.
	 */
	private userLeft(user: MRE.User) {
		// If the user was wearing an item, destroy it. Otherwise it would be
		// orphaned in the world.
		this.removeItemFromUser(user);
		this.closeOpenedMenus(user);
	}

	private showLogoButton(): void {
		// Create a parent object for all the menu items.
		const menu = MRE.Actor.Create(this.context, {});

		// Create menu button
		const buttonMesh = this.assets.createBoxMesh('button', 0.1, 0.1, 0.1);
		const logoButton = MRE.Actor.Create(this.context, {
			actor: {
				parentId: menu.id,
				name: 'logo-button',
				appearance: { meshId: buttonMesh.id },
				collider: { enabled: true, geometry: { shape: MRE.ColliderType.Auto } },
				transform: {
					local: { position: { x: 0, y: 0, z: 0 } }
				}
			}
		});

		logoButton.setBehavior(MRE.ButtonBehavior)
			.onClick(user => {
				if (this.openedMenus.has(user.id)) {
					this.openedMenus.get(user.id).destroy();
					this.openedMenus.delete(user.id);
					return;
				}
				userManager.isUserPermitted(this.currentAppId, user?.id, user?.name).then((permissionStatus) => {
					if (!permissionStatus?.permitted || !permissionStatus?.permittedResources?.length) {
						console.log(`User: ${user.id} (${user.name}) is not permitted to see the items`);
						// eslint-disable-next-line max-len
						userManager.insertUnauthorizedUser(this.currentAppId, user?.id, user?.name).catch((error) => console.error(error));
						return;
					}
					console.log(`Showing items for the user: ${user.id} (${user.name})`);
					this.showHorizontalItemMenu(user, permissionStatus?.permittedResources || []);
				// eslint-disable-next-line @typescript-eslint/unbound-method
				}).catch(console.error);
			});
	}

	private showHorizontalItemMenu(user?: MRE.User, permittedResources?: string[]) {
		// a menu is already opened. Just close it.
		if (this.openedMenus.has(user.id)) {
			return;
		}

		// Create a parent object for all the menu items.
		const menu = MRE.Actor.Create(this.context, {});
		let x = 1;

		// Loop over the item database, creating a menu item for each entry.
		for (const itemId of Object.keys(this.itemDatabase)) {
			const itemRecord = this.itemDatabase[itemId];

			if (itemId === CLEAR_BUTTON_ID) {
				// If the user selected 'CLEAR', then render clear button.
				MRE.Actor.CreateFromLibrary(this.context, {
					resourceId: CLEAR_BUTTON_RESOURCE_ID,
					actor: {
						parentId: menu.id,
						name: itemId,
						transform: {
							local: { position: { x, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }
						}
					}
				});
			} else {
				if (!permittedResources?.includes(itemRecord?.resourceId)) {
					continue;
				}

				MRE.Actor.CreateFromLibrary(this.context, {
					resourceId: itemRecord?.resourceId,
					actor: {
						parentId: menu.id,
						name: itemId,
						transform: {
							local: {
								position: { 
									x,
									y: itemRecord?.menuPosition?.y || 0,
									z: itemRecord?.menuPosition?.z || 0,
								},
								rotation: MRE.Quaternion.FromEulerAngles(
									(itemRecord?.menuRotation?.x || 0) * MRE.DegreesToRadians,
									(itemRecord?.menuRotation?.y || 0) * MRE.DegreesToRadians,
									(itemRecord?.menuRotation?.z || 0) * MRE.DegreesToRadians),
								scale: itemRecord?.menuScale,
							}
						},
					}
				})
			}

			// Create an invisible cube with a collider
			const button = MRE.Actor.CreatePrimitive(this.assets, {
				definition: {
					shape: MRE.PrimitiveShape.Box,
					dimensions: { x: 0.4, y: 0.4, z: 0.4 } // make sure there's a gap
				},
				addCollider: true,
				actor: {
					parentId: menu.id,
					name: `${itemId} collider`,
					transform: {
						local: {
							position: { x, y: 0, z: 0 },
							scale: { x: 1, y: 1, z: 1 },
						}
					},
					appearance: {
						enabled: false
					}
				}
			});

			// Set a click handler on the button.
			button.setBehavior(MRE.ButtonBehavior)
			.onClick(clickedUser => {
				userManager.isUserPermitted(this.currentAppId, user?.id, user?.name).then((permissionStatus) => {
					const userName = `${clickedUser.id} (${clickedUser.name})`;
					if (!permissionStatus?.permitted || (itemId !== CLEAR_BUTTON_ID && !permissionStatus?.permittedResources?.includes(itemRecord?.resourceId))) {
						console.log(`User: ${userName}) is not permitted to wear item ${itemId}`);
						userManager
							.insertUnauthorizedUser(this.currentAppId, clickedUser?.id, clickedUser?.name)
							// eslint-disable-next-line @typescript-eslint/unbound-method
							.catch(console.error);
						return;
					}
					console.log(`Permitting the request to wear item ${itemId} from the user: ${userName}`);
					this.wearItem(itemId, clickedUser.id);
				// eslint-disable-next-line @typescript-eslint/unbound-method
				}).catch(console.error);
				
			});

			x = x + 1;
		}

		this.openedMenus.set(user.id, menu);
	}

	private wearItem(itemId: string, userId: MRE.Guid) {
		// If the user is wearing an item, destroy it.
		this.removeItemFromUser(this.context.user(userId));

		const itemRecord = this.itemDatabase[itemId];

		// If the user selected 'CLEAR', then early out.
		if (itemId === CLEAR_BUTTON_ID) {
			return;
		}

		// Create the item model and attach it to the avatar.
		this.attachedItems.set(userId, MRE.Actor.CreateFromLibrary(this.context, {
			resourceId: itemRecord?.resourceId,
			actor: {
				transform: {
					local: {
						position: itemRecord?.position,
						rotation: MRE.Quaternion.FromEulerAngles(
							(itemRecord?.rotation?.x || 0) * MRE.DegreesToRadians,
							(itemRecord?.rotation?.y || 0) * MRE.DegreesToRadians,
							(itemRecord?.rotation?.z || 0) * MRE.DegreesToRadians),
						scale: itemRecord?.scale,
					}
				},
				attachment: {
					attachPoint: itemRecord?.attachPoint || 'head',
					userId
				}
			}
		}));
	}

	private removeItemFromUser(user: MRE.User) {
		if (this.attachedItems.has(user.id)) { this.attachedItems.get(user.id).destroy(); }
		this.attachedItems.delete(user.id);
	}

	private closeOpenedMenus(user: MRE.User) {
		if (this.openedMenus.has(user.id)) { this.openedMenus.get(user.id).destroy(); }
		this.openedMenus.delete(user.id);
	}
}
