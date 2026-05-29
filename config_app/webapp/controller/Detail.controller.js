sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/f/library",
  "sap/m/Text", "sap/m/Tokenizer", "sap/m/Token",
  "sap/m/ColumnListItem", "sap/ui/core/Fragment", "sap/m/Button",
  "sap/m/MessageToast",
   "sap/m/MessageBox"
], function (Controller, JSONModel, fioriLibrary,  Text, Tokenizer, Token, ColumnListItem, Fragment, Button, MessageToast, MessageBox) {
  "use strict";

  return Controller.extend("com.config.app.configapp.controller.Detail", {
    onInit() {
      this.oRouter = this.getOwnerComponent().getRouter();
      this.oRouter.getRoute("Detail").attachPatternMatched(this._onDetailMatched, this);
      this.getView().setModel(new JSONModel({
        deleteEnabled: false, }), "view");
    },

    _onDetailMatched(oEvent) {
      const key = oEvent.getParameter("arguments").key;
      if (!key) {
        this.handleClose();
        return;
      }
      this._sHeaderPath = `/Searchheader(ID='${key}')`;
      this._loadData();
    },

    _loadData() {
      const oView = this.getView();
      const oTable = oView.byId("mailTable");

      this.getOwnerComponent().getModel().read(this._sHeaderPath, {
        urlParameters: { "$expand": "Items_s" },
        success: oData => {
          oView.setModel(new JSONModel(oData), "detailModel");
          oView.bindElement({ path: "/", model: "detailModel" });

          const rows = (oData.Items_s?.results || []).map(item => ({
            mailid: item.mailid,
            sTokens: (item.subject || "").split(";").map(t => t.trim()).filter(Boolean),
            ItemID: item.ID || item.ItemID
          }));

          const mailModel = new JSONModel({ rows, selectedCount: 0 });
          mailModel.setSizeLimit(rows.length + 10);
          oView.setModel(mailModel, "mailModel");

          oTable.removeSelections();
          oTable.getBinding("items").attachDataReceived(() => {
            oView.byId("btnDelete").setEnabled(rows.length > 0);
          });
        },
        error: () => MessageToast.show("Error fetching detail data")
      });
     
    },
    

    buildTable(_, context) {
      const row = context.getModel("mailModel").getProperty(context.getPath());
      return new ColumnListItem({
        cells: [
          new Text({ text: "{mailModel>mailid}" }),
          new Tokenizer({
            tokens: row.sTokens.map(s => new Token({ text: s, key: s })),
            editable: false,
            renderMode: sap.m.TokenizerRenderMode.Loose
          }),
          new Button({
            icon: "sap-icon://edit",
            type: "Transparent",
            press: this.onLineEdit.bind(this)
          })
        ]
      });
    },

    onSelectionChange(oEvent) {
      const count = oEvent.getSource().getSelectedItems().length;
      this.getView().getModel("mailModel").setProperty("/selectedCount", count);
      this.byId("btnDelete").setEnabled(count > 0);
    },

    onAddRow() {
      this._isEdit = false;
      this._editPath = null;
      this._openDialog({ mailid: "", sTokens: [], ItemID: null });
    },

    onLineEdit(oEvent) {
      debugger;
      const path = oEvent.getSource()
        .getParent()
        .getBindingContext("mailModel")
        .getPath();
      this._isEdit = true;
      this._editPath = path;

      const row = this.getView().getModel("mailModel").getProperty(path);
      this._openDialog({ mailid: row.mailid, sTokens: row.sTokens, ItemID: row.ItemID });
    },

    _openDialog(data) {
      const title = this._isEdit ? "Edit Mail Entry" : "Add Mail Entry";

      data.isEdit = !!this._isEdit;         // identifies mode
      data.mailValueState = "None";
      data.mailValueStateText = "";
      data.hasChanged = false;              // tracks changes

      const init = dlg => {
        this.getView().addDependent(dlg);
        this._oDialog = dlg;
        dlg.setTitle(title);
        this._oDialog.setModel(new JSONModel(data), "dialogModel");
        this._oDialog.open();
      };

      if (!this._oDialog) {
        Fragment.load({
          id: this.getView().getId(),
          name: "com.config.app.configapp.view.MailDialog",
          controller: this
        }).then(init);
      } else {
        this._oDialog.setTitle(title);
        this._oDialog.setModel(new JSONModel(data), "dialogModel");
        this._oDialog.open();
      }
    },

    onMailIdChange(oEvent) {
      const m = this._oDialog.getModel("dialogModel");
      const val = oEvent.getSource().getValue().trim();
    
      // basic validation (optional in edit)
      if (val) {
        const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
        m.setProperty("/mailValueState", ok ? "Success" : "Error");
        m.setProperty("/mailValueStateText", ok ? "" : "Invalid email");
      } else {
        m.setProperty("/mailValueState", "None");
        m.setProperty("/mailValueStateText", "");
      }
    
      m.setProperty("/hasChanged", true);
    },
    
    onTokenSubmit(oEvent) {
      const m = this._oDialog.getModel("dialogModel");
      const value = oEvent.getParameter("value").trim();
      if (!value) return;
    
      let tokens = m.getProperty("/sTokens") || [];
      if (!tokens.includes(value)) {
        tokens = [...tokens, value];
        m.setProperty("/sTokens", tokens);
      }
    
      oEvent.getSource().setValue("");
      m.setProperty("/hasChanged", true);
    },
    
    onTokenUpdate(oEvent) {
      const m = this._oDialog.getModel("dialogModel");
      const removed = oEvent.getParameter("removedTokens")[0].getText();
      let tokens = m.getProperty("/sTokens") || [];
      tokens = tokens.filter(t => t !== removed);
      m.setProperty("/sTokens", tokens);
      m.setProperty("/hasChanged", true);
    },
    _validateDialogInputs() {
      const oModel = this._oDialog.getModel("dialogModel");
      const mailState = oModel.getProperty("/mailValueState");
      const aTokens = oModel.getProperty("/sTokens") || [];
      const bValid = mailState === "Success" && aTokens.length > 0;
      oModel.setProperty("/valid", bValid);
    } ,
    
    onDialogSave() {
      const d = this._oDialog.getModel("dialogModel").getData();
      const payload = {
        mailid: d.mailid,
        subject: d.sTokens.join(";")
      };
      const oOData = this.getOwnerComponent().getModel();
    
      const fn = this._isEdit
        ? oOData.update.bind(oOData, `${this._sHeaderPath}/Items_s('${d.ItemID}')`, payload)
        : oOData.create.bind(oOData, `${this._sHeaderPath}/Items_s`, payload);
    
      fn({
        success: () => {
          MessageToast.show(this._isEdit ? "Updated successfully" : "Added successfully");
          this._loadData();
          this._oDialog.close();
        },
        error: () => {
          MessageToast.show("Error saving item");
        }
      });
    },
    

    onDialogCancel() {
      this._oDialog.close();
      MessageToast.show(this._isEdit ? "Edit cancelled" : "Add cancelled");
    },

    onDelete() {
      const table = this.byId("mailTable");
      const items = table.getSelectedItems();
    
      if (!items.length) {
        MessageToast.show("Select at least one to delete");
        return;
      }
    
      MessageBox.confirm("Are you sure you want to delete the selected item(s)?", {
        title: "Confirm Deletion",
        actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
        onClose: (oAction) => {
          if (oAction === MessageBox.Action.OK) {
            const oOData = this.getOwnerComponent().getModel();
            let count = 0;
    
            items.forEach(item => {
              const row = item.getBindingContext("mailModel").getObject();
              if (!row.ItemID) {
                MessageToast.show("Cannot delete row without valid ID");
                return;
              }
    
              oOData.remove(`${this._sHeaderPath}/Items_s('${row.ItemID}')`, {
                success: () => {
                  count++;
                  if (count === items.length) {
                    MessageToast.show("Selected item(s) deleted");
                    this._loadData();
                  }
                },
                error: () => MessageToast.show(`Error deleting ${row.ItemID}`)
              });
            });
          }
        }
      });
    },
    

    handleClose() {
      this.getView().getParent().getParent()
        .setLayout(fioriLibrary.LayoutType.OneColumn);
    }
  });
});
