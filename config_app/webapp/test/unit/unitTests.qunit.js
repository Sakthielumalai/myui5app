/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"com/config/app/configapp/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});
