/* eslint-disable no-mixed-spaces-and-tabs */

import { Context, GroupMask, Guid, User } from "@microsoft/mixed-reality-extension-sdk";

import { generateRandomString } from "./utils";

class GroupMaskManager {
  private static readonly PREFIX = "USER_MASK_";
  private readonly randomPortion: string;

  private readonly maskMap: Map<Guid, GroupMask>;
  private readonly context: Context;

  constructor(context: Context) {
  	this.context = context;
  	this.maskMap = new Map();
  	this.randomPortion = generateRandomString(16);
  }

  createGroupMaskForUser(user: User): GroupMask {
  	const mask = new GroupMask(this.context, [this.getGroupMaskTagForUser(user)]);
  	this.maskMap.set(user.id, mask);
  	return mask;
  }

  getGroupMaskForUser(user: User): GroupMask | null {
  	return this.maskMap.get(user.id) || null;
  }

  getGroupMaskTagForUser(user: User): string {
  	return `${GroupMaskManager.PREFIX}${this.randomPortion}_${user.id}`;
  }

  removeGroupMaskForUser(user: User): void {
  	this.maskMap.delete(user.id);
  }
}

export default GroupMaskManager;
