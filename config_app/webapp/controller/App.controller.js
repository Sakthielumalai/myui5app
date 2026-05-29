sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/UIComponent",
  "sap/f/library"
], (Controller, UIComponent, fioriLibrary) => {
  "use strict";

  return Controller.extend("com.config.app.configapp.controller.App", {

    onInit() {
      this.oOwnerComponent = this.getOwnerComponent();
      this.oRouter = this.oOwnerComponent.getRouter();

      this.oRouter.attachBeforeRouteMatched(this._onBeforeRouteMatched, this);
      
      // no prototype.init here — controller init does not require it
    },

    _onBeforeRouteMatched(oEvent) {
      const sLayout = oEvent.getParameter("arguments").layout
        || fioriLibrary.LayoutType.OneColumn;
      this.getView().getModel().setProperty("/layout", sLayout);
    },

    onStateChanged(oEvent) {
      if (oEvent.getParameter("isNavigationArrow")) {
        this.oRouter.navTo(this.currentRouteName, {
          layout: oEvent.getParameter("layout"),
          // add product or other args if you use them
        }, true);
      }
    },
   

  });
});
