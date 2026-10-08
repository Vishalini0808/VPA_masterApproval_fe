/*global QUnit*/

sap.ui.define([
	"vpamasterapproval/controller/masterApproval.controller"
], function (Controller) {
	"use strict";

	QUnit.module("masterApproval Controller");

	QUnit.test("I should test the masterApproval controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
