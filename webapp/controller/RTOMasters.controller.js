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

    return Controller.extend("vpamasterapproval.controller.RTOMasters", {

        onInit: function () {
            this.getView().setModel(new JSONModel({
                pendingCountText: "Loading..."
            }), "rtoApprovalVM");
        },

        onRowsUpdated: function () {
            var oBinding = this.byId("rtoApprovalTable").getBinding("rows");
            if (!oBinding) { return; }

            var iCount = oBinding.getLength();
            if (iCount === undefined || iCount < 0) { return; }

            this.getView().getModel("rtoApprovalVM").setProperty(
                "/pendingCountText",
                iCount + (iCount === 1 ? " record" : " records") + " pending for approval"
            );
        },

        /* 0.0800 -> 8 */
        formatPercent: function (v) {
            if (v === null || v === undefined || v === "") { return ""; }
            return String(parseFloat((parseFloat(v) * 100).toFixed(2)));
        },

        onSearch: function () {
            var sQuery = this.byId("rtoApprovalSearchField").getValue().trim();
            var sField = this.byId("rtoApprovalFieldFilterSelect").getSelectedKey();
            var oBinding = this.byId("rtoApprovalTable").getBinding("rows");

            var aFilters = [];
            if (sQuery) {
                var fRegion = new Filter("region_regionCode", FilterOperator.Contains, sQuery);
                var fEngine = new Filter("engineType", FilterOperator.Contains, sQuery);

                if (sField === "regionCode") {
                    aFilters.push(fRegion);
                } else if (sField === "engineType") {
                    aFilters.push(fEngine);
                } else {
                    aFilters.push(new Filter({ filters: [fRegion, fEngine], and: false }));
                }
            }

            oBinding.filter(aFilters, FilterType.Control);
        },

        onRefresh: function () {
            this.byId("rtoApprovalTable").getBinding("rows").refresh();
        },

        onApprove: function (oEvent) {
            this._confirmAndCallAction(oEvent, "approveMaster",
                "Do you want to approve this RTO record?", "approved");
        },

        onReject: function (oEvent) {
            this._confirmAndCallAction(oEvent, "rejectMaster",
                "Do you want to reject this RTO record?", "rejected");
        },

        _confirmAndCallAction: function (oEvent, sActionName, sText, sDoneText) {
            var oCtx = oEvent.getSource().getBindingContext();
            var oModel = this.getView().getModel();
            var oTable = this.byId("rtoApprovalTable");

            MessageBox.confirm(sText, {
                title: "Confirm",
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                emphasizedAction: MessageBox.Action.YES,
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.YES) { return; }

                    oCtx.requestProperty("id").then(function (sId) {
                        var oAction = oModel.bindContext("/" + sActionName + "(...)");
                        oAction.setParameter("entityName", "RTOMasters");
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
                        oTable.getBinding("rows").refresh();
                    }).catch(function (oErr) {
                        MessageBox.error(oErr.message);
                    });
                }
            });
        }
    });
});