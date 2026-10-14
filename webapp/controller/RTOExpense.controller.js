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

    return Controller.extend("vpamasterapproval.controller.RTOExpense", {

        onInit: function () {
            this.getView().setModel(new JSONModel({
                pendingCountText: "Loading..."
            }), "rtoExpenseApprovalVM");
        },

        /* ---------- header count ---------- */
        onRowsUpdated: function () {
            var oBinding = this.byId("rtoExpenseApprovalTable").getBinding("rows");
            if (!oBinding) { return; }

            var iCount = oBinding.getLength();
            if (iCount === undefined || iCount < 0) { return; }

            this.getView().getModel("rtoExpenseApprovalVM").setProperty(
                "/pendingCountText",
                iCount + (iCount === 1 ? " record" : " records") + " pending for approval"
            );
        },

        /* ---------- search ---------- */
        onSearch: function () {
            var sQuery = this.byId("rtoExpenseApprovalSearchField").getValue().trim();
            var sField = this.byId("rtoExpenseApprovalFieldFilterSelect").getSelectedKey();
            var oBinding = this.byId("rtoExpenseApprovalTable").getBinding("rows");

            var aFilters = [];
            if (sQuery) {
                var fRegion = new Filter("region_regionCode", FilterOperator.Contains, sQuery);
                var fEngine = new Filter("engineType", FilterOperator.Contains, sQuery);

                if (sField === "regionCode") {
                    aFilters.push(fRegion);
                } else if (sField === "engineType") {
                    aFilters.push(fEngine);
                } else {
                    aFilters.push(new Filter({ filters: [fRegion, fEngine], and: false }));  // OR
                }
            }

            // Control filters are AND-ed with the SUBMITTED Application filter from the view.
            // (Using "Application" here would REPLACE the SUBMITTED filter.)
            oBinding.filter(aFilters, FilterType.Control);
        },

        onRefresh: function () {
            this.byId("rtoExpenseApprovalTable").getBinding("rows").refresh();
        },

        /* ---------- approve / reject via actions ---------- */
        onApprove: function (oEvent) {
            this._confirmAndCallAction(
                oEvent,
                "approveMaster",
                "Do you want to approve this RTO expense record?",
                "approved"
            );
        },

        onReject: function (oEvent) {
            this._confirmAndCallAction(
                oEvent,
                "rejectMaster",
                "Do you want to reject this RTO expense record?",
                "rejected"
            );
        },

        _confirmAndCallAction: function (oEvent, sActionName, sText, sDoneText) {
            var oCtx = oEvent.getSource().getBindingContext();
            var oModel = this.getView().getModel();
            var oTable = this.byId("rtoExpenseApprovalTable");

            MessageBox.confirm(sText, {
                title: "Confirm",
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                emphasizedAction: MessageBox.Action.YES,
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.YES) { return; }

                    oCtx.requestProperty("id").then(function (sId) {
                        var oAction = oModel.bindContext("/" + sActionName + "(...)");

                        oAction.setParameter("entityName", "RTOExpense");
                        oAction.setParameter("recordKey", JSON.stringify({ id: sId }));

                        return oAction.execute("$direct").then(function () {
                            return oAction.getBoundContext().getObject();
                        });
                    }).then(function (oResult) {
                        if (oResult && oResult.value === false) {
                            MessageBox.error("The record could not be " + sDoneText + ".");
                            return;
                        }
                        MessageToast.show("Record " + sDoneText);
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