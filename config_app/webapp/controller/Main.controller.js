sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "com/config/app/configapp/model/Servants",
  "sap/ui/model/json/JSONModel",
  "sap/f/library",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], (Controller, Servants, JSONModel, fioriLibrary, Filter, FilterOperator, MessageToast, MessageBox) => {
  "use strict";

  return Controller.extend("com.config.app.configapp.controller.Main", {
    onInit() {
     console.log("---------------- App starting -------------------");
      this.globalModel = this.getOwnerComponent().getModel();
      this._getInitData();
      this.getView().setModel(new JSONModel({ deleteEnabled: false, activateEnabled: false }), "view");
    },

    async _getInitData() {
      const oData = await Servants._ReadData(this.globalModel, "/Searchheader");
      this.getOwnerComponent().setModel(new JSONModel(oData.results), "list");

      const uniq = (arr, prop) => [...new Set(arr.map(r => r[prop]).filter(Boolean))];

      this.getView().setModel(
        new JSONModel(uniq(oData.results, "machine_name").map(m => ({ key: m, name: m }))),
        "machinemodel"
      );
      this.getView().setModel(
        new JSONModel(uniq(oData.results, "Status").map(s => ({ key: s, name: s }))),
        "statusmodel"
      );

      this._updateTableCount();
    },

    _updateTableCount() {
      const oTable = this.byId("innerTable");
      const oBinding = oTable.getBinding("items");
      if (oBinding) {
        this.byId("tableCountLabel").setText(`Total No of Records: ${oBinding.getLength()}`);
      }
    },

    onFilterChanged() {
      debugger;
      const aFilters = [];
      const sName = this.byId("inputName").getValue();
      const aMachine = this.byId("mcbMachine").getSelectedKeys();
      const aStatus = this.byId("mcbStatus").getSelectedKeys();

      if (sName) aFilters.push(new Filter("Name", FilterOperator.Contains, sName));
      if (aMachine.length) {
        aFilters.push(new Filter({
          filters: aMachine.map(k => new Filter("machine_name", FilterOperator.EQ, k)),
          and: false
        }));
      }
      if (aStatus.length) {
        aFilters.push(new Filter({
          filters: aStatus.map(k => new Filter("Status", FilterOperator.EQ, k)),
          and: false
        }));
      }

      const oTable = this.byId("innerTable");
      oTable.setBusy(true);

      this.globalModel.read("/Searchheader", {
        filters: aFilters,
        success: oData => {
          this.getView().getModel("list").setData(oData.results);
          this._updateTableCount();
          oTable.setBusy(false);
        },
        error: () => {
          MessageToast.show("Error during filter");
          oTable.setBusy(false);
        }
      });
    },

    onAfterVariantLoad() {
      this.onFilterChanged();
    },

    onTableSelectionChange(oEvent) {
      const aSel = oEvent.getSource().getSelectedItems();
      const oVM = this.getView().getModel("view");
    
      if (aSel.length === 0) {
        // Nothing selected — disable both buttons
        oVM.setProperty("/deleteEnabled", false);
        oVM.setProperty("/activateEnabled", false);
        return;
      }
    
      // Check if all selected rows are Inactive
      const allInactive = aSel.every(item => {
        const status = item.getBindingContext("list").getProperty("Status");
        return !status || status.toLowerCase() === "inactive" || status.toLowerCase() === "in-active";
      });
    
      oVM.setProperty("/deleteEnabled", true);
      oVM.setProperty("/activateEnabled", allInactive);
    },

    onListItemPress(oEvent) {
      const sPath = oEvent.getSource().getBindingContext("list").getPath();
      const sID = this.getView().getModel("list").getProperty(`${sPath}/ID`);
      this.getOwnerComponent().getRouter().navTo("Detail", {
        layout: fioriLibrary.LayoutType.TwoColumnsMidExpanded,
        key: sID
      });
    },

    onCreate() {
      if (!this._oDialog) {
        this.loadFragment({ name: "com.config.app.configapp.view.AgentDialog", controller: this }).then(dialog => {
          this._oDialog = dialog;
          this.getView().addDependent(dialog);
          this._openCreateDialog();
        });
      } else {
        this._openCreateDialog();
      }
    },

    _openCreateDialog() {
      this.oDialogData = { username: "", machinename: "" };
      const oDialogModel = new JSONModel(this.oDialogData);
      this.getView().setModel(oDialogModel, "newRecord");
      this._oDialog.open();
    },

    onSaveAgent: async function () {
      const oNew = this.getView().getModel("newRecord").getData();
      const osaveModel = this.getOwnerComponent().getModel();
      const oDataModel = new sap.ui.model.odata.ODataModel(osaveModel.sServiceUrl);
      const batchArray = [];
      const oEntry = { Name: oNew.username, machine_name: oNew.machinename };

      batchArray.push(oDataModel.createBatchOperation("/Searchheader", "POST", oEntry));
      oDataModel.addBatchChangeOperations(batchArray);

      try {
        await Servants._SubmitBatchData(oDataModel);
        MessageToast.show("Agent created successfully.");
      } catch (err) {
        console.error(err);
        MessageToast.show("Error creating agent.");
      }

      this._oDialog.close();
    },

    onCancelAgent() { this._oDialog.close(); },

    onAfterClose: async function () {
      const data = await Servants._ReadData(this.globalModel, "/Searchheader");
      this.getView().getModel("list").setData(data.results);
      this.getView().getModel("list").updateBindings();
    },

    onActivate() {
      const oTable = this.byId("innerTable");
      const aSel = oTable.getSelectedItems();
      if (!aSel.length) return MessageToast.show("Please select one or more rows to activate.");

      const allInactive = aSel.every(item => {
        const status = item.getBindingContext("list").getProperty("Status");
        return !status || status.toLowerCase() === "inactive" || status.toLowerCase() === "in-active";
      });

      if (!allInactive) return MessageToast.show("Activate only when all selected rows are blank or 'Inactive'.");

      const oModel = this.getOwnerComponent().getModel();
      oModel.setDeferredGroups(["activateGroup"]);

      aSel.forEach(item => {
        const sKey = item.getBindingContext("list").getProperty("ID");
        const sPath = `/Searchheader('${sKey}')`;

        oModel.update(sPath, { Status: "Active" }, {
          groupId: "activateGroup",
          changeSetId: "set1",
          success: () => console.log(`Updated ID ${sKey}`),
          error: () => console.error(`Failed to update ID ${sKey}`)
        });
      });

      oModel.submitChanges({
        groupId: "activateGroup",
        success: () => {
          MessageToast.show("Activated successfully");
          this._refreshRows(aSel, "Active");
        },
        error: () => MessageToast.show("Activation failed. Check console.")
      });
    },

    _refreshRows(aItems, newStatus) {
      const oListModel = this.getView().getModel("list");
      const aData = oListModel.getData();
      const aIDs = aItems.map(i => i.getBindingContext("list").getProperty("ID"));

      aData.forEach(entry => {
        if (aIDs.includes(entry.ID)) entry.Status = newStatus;
      });

      oListModel.setData(aData);
      oListModel.refresh();
      this.byId("innerTable").removeSelections();

      oTable.removeSelections();
      const oVM = this.getView().getModel("view");
      oVM.setProperty("/deleteEnabled", false);
      oVM.setProperty("/activateEnabled", false);
    },

    onDel() {
      const oTable = this.byId("innerTable");
      const aSelected = oTable.getSelectedItems();
    
      if (!aSelected.length) {
        return MessageToast.show("Please select one or more rows to delete.");
      }
    
      // Show confirmation popup
      sap.m.MessageBox.confirm("Are you sure you want to delete the selected records?", {
        title: "Confirm Deletion",
        actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
        onClose: sAction => {
          if (sAction !== sap.m.MessageBox.Action.OK) return;
    
          const oODataModel = this.getOwnerComponent().getModel();
          oODataModel.setDeferredGroups(["deletionGroup"]);
    
          aSelected.forEach(item => {
            const sKey = item.getBindingContext("list").getProperty("ID");
            const sPath = `/Searchheader('${sKey}')`;
    
            oODataModel.remove(sPath, {
              groupId: "deletionGroup",
              changeSetId: "deleteChangeSet"
            });
          });
    
          oODataModel.submitChanges({
            groupId: "deletionGroup",
            success: () => {
              MessageToast.show("Deleted successfully");
              const oListModel = this.getView().getModel("list");
              const aData = oListModel.getData();
              const aSelKeys = aSelected.map(i => i.getBindingContext("list").getProperty("ID"));
              const filtered = aData.filter(e => !aSelKeys.includes(e.ID));
              oListModel.setData(filtered);
              oListModel.refresh();
    
              oTable.removeSelections();
              const oVM = this.getView().getModel("view");
              oVM.setProperty("/deleteEnabled", false);
              oVM.setProperty("/activateEnabled", false);
            },
            error: () => MessageToast.show("Deletion failed. Please check console.")
          });
        }
      });
    },
  
       
  }  )
    
    
 
    
  });

