sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/FilterType",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, JSONModel, Filter, FilterOperator, FilterType, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("vpamasterapproval.controller.Parts", {

        onInit: function () {
            // view model: only holds the "N records pending for approval" text
            this.getView().setModel(new JSONModel({
                pendingCountText: "Loading..."
            }), "partsApprovalVM");
        },

        /* ---------- header count ---------- */
        onRowsUpdated: function () {
            var oBinding = this.byId("partsApprovalTable").getBinding("rows");
            if (!oBinding) { return; }

            var iCount = oBinding.getLength();   // works because of $count: true in the view
            if (iCount === undefined || iCount < 0) { return; }

            this.getView().getModel("partsApprovalVM").setProperty(
                "/pendingCountText",
                iCount + (iCount === 1 ? " record" : " records") + " pending for approval"
            );
        },

        /* ---------- search ---------- */
        onSearch: function () {
            var sQuery = this.byId("partsApprovalSearchField").getValue().trim();
            var sField = this.byId("partsApprovalFieldFilterSelect").getSelectedKey();
            var oBinding = this.byId("partsApprovalTable").getBinding("rows");

            var aFilters = [];
            if (sQuery) {
                var fCode = new Filter("partCode", FilterOperator.Contains, sQuery);
                var fDesc = new Filter("description", FilterOperator.Contains, sQuery);

                if (sField === "partCode") {
                    aFilters.push(fCode);
                } else if (sField === "description") {
                    aFilters.push(fDesc);
                } else {
                    aFilters.push(new Filter({ filters: [fCode, fDesc], and: false }));  // OR
                }
            }

            // Control filters are AND-ed with the SUBMITTED filter defined in the view
            oBinding.filter(aFilters, FilterType.Control);
        },

        onRefresh: function () {
            this.byId("partsApprovalTable").getBinding("rows").refresh();
        },

        /* ---------- approve / reject via actions ---------- */
        onApprove: function (oEvent) {
            this._confirmAndCallAction(
                oEvent,
                "approveMaster",
                "Do you want to approve this part?",
                "approved"
            );
        },

        onReject: function (oEvent) {
            this._confirmAndCallAction(
                oEvent,
                "rejectMaster",
                "Do you want to reject this part?",
                "rejected"
            );
        },

        _confirmAndCallAction: function (oEvent, sActionName, sText, sDoneText) {
            var oCtx = oEvent.getSource().getBindingContext();   // V4 context of this row
            var oModel = this.getView().getModel();
            var oTable = this.byId("partsApprovalTable");

            MessageBox.confirm(sText, {
                title: "Confirm",
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                emphasizedAction: MessageBox.Action.YES,
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.YES) { return; }

                    oCtx.requestProperty("partCode").then(function (sPartCode) {
                        // unbound action: "/<ActionImportName>(...)"
                        var oAction = oModel.bindContext("/" + sActionName + "(...)");

                        oAction.setParameter("entityName", "Parts");
                        // recordKey is a JSON string: {"partCode":"<code>"}
                        oAction.setParameter("recordKey", JSON.stringify({ partCode: sPartCode }));

                        // "$direct" = sent immediately, no batch group to submit
                        return oAction.execute("$direct").then(function () {
                            return oAction.getBoundContext().getObject();
                        });
                    }).then(function (oResult) {
                        // actions return Edm.Boolean -> { value: true/false }
                        if (oResult && oResult.value === false) {
                            MessageBox.error("The part could not be " + sDoneText + ".");
                            return;
                        }
                        MessageToast.show("Part " + sDoneText);
                        // refresh keeps the SUBMITTED filter, so the row leaves the list
                        oTable.getBinding("rows").refresh();
                    }).catch(function (oErr) {
                        MessageBox.error(oErr.message);
                    });
                }
            });
        }
    });
});