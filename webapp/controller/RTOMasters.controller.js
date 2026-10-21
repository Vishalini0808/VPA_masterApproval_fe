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
                pendingCountText: "Loading...",
                selectedCount: 0

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

        onSelectionChange: function () {

            var oTable = this.byId("rtoApprovalTable");

            this.getView()
                .getModel("rtoApprovalVM")
                .setProperty(
                    "/selectedCount",
                    oTable.getSelectedIndices().length
                );

        },

        _clearSelection: function () {

            this.byId("rtoApprovalTable").clearSelection();

            this.getView()
                .getModel("rtoApprovalVM")
                .setProperty("/selectedCount", 0);

        },


        onSearch: function () {
            this._clearSelection();
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
            this._clearSelection();
            this.byId("rtoApprovalTable").getBinding("rows").refresh();
        },

        onApproveSelected: function () {

            this._processSelectedRTO(
                "approveMaster",
                "approve"
            );

        },

        onRejectSelected: function () {

            this._processSelectedRTO(
                "rejectMaster",
                "reject"
            );

        },

        _processSelectedRTO: async function (sAction, sOperation) {

            var oTable = this.byId("rtoApprovalTable");
            var oModel = this.getView().getModel();
            var aIndices = oTable.getSelectedIndices();

            if (!aIndices.length) {
                MessageToast.show("Please select at least one RTO record");
                return;
            }

            var aContexts = aIndices.map(function (iIndex) {
                return oTable.getContextByIndex(iIndex);
            });

            if (aContexts.some(function (oContext) {
                return !oContext;
            })) {
                MessageBox.warning(
                    "Some selected records are still loading. Please try again."
                );
                return;
            }

            // Read primary keys before processing
            var aRecords;

            try {

                aRecords = await Promise.all(
                    aContexts.map(async function (oContext) {

                        return {
                            id: await oContext.requestProperty("id")
                        };

                    })
                );

            } catch (oError) {

                MessageBox.error(
                    "Unable to read selected RTO records: " + oError.message
                );

                return;
            }

            if (aRecords.some(function (oRecord) {
                return oRecord.id === null ||
                    oRecord.id === undefined ||
                    oRecord.id === "";
            })) {

                MessageBox.error(
                    "Record ID is missing for one or more selected RTO records."
                );

                return;
            }

            MessageBox.confirm(
                "Are you sure you want to " +
                sOperation + " " +
                aRecords.length + " selected RTO record(s)?",
                {
                    title: sOperation === "approve"
                        ? "Confirm Approval"
                        : "Confirm Rejection",

                    actions: [
                        MessageBox.Action.YES,
                        MessageBox.Action.NO
                    ],

                    emphasizedAction: MessageBox.Action.YES,

                    onClose: async function (sResult) {

                        if (sResult !== MessageBox.Action.YES) {
                            return;
                        }

                        var iSuccess = 0;
                        var aFailed = [];

                        oTable.setBusy(true);

                        try {

                            for (const oRecord of aRecords) {

                                try {

                                    var oAction = oModel.bindContext(
                                        "/" + sAction + "(...)"
                                    );

                                    oAction.setParameter(
                                        "entityName",
                                        "RTOMasters"
                                    );

                                    oAction.setParameter(
                                        "recordKey",
                                        JSON.stringify({
                                            id: oRecord.id
                                        })
                                    );

                                    // Retain existing direct execution
                                    await oAction.execute("$direct");

                                    var oResult = oAction
                                        .getBoundContext()
                                        .getObject();

                                    if (oResult && oResult.value === false) {
                                        throw new Error("Backend returned false");
                                    }

                                    iSuccess++;

                                } catch (oError) {

                                    aFailed.push({
                                        id: oRecord.id,
                                        error: oError.message
                                    });

                                }

                            }

                            this._clearSelection();

                            var oBinding = oTable.getBinding("rows");

                            if (oBinding) {
                                oBinding.refresh();
                            }

                            if (aFailed.length === 0) {

                                MessageToast.show(
                                    iSuccess +
                                    " RTO record(s) successfully " +
                                    (sOperation === "approve"
                                        ? "approved"
                                        : "rejected")
                                );

                            } else {

                                MessageBox.warning(
                                    iSuccess + " succeeded, " +
                                    aFailed.length + " failed.\n\n" +
                                    aFailed.map(function (oItem) {

                                        return oItem.id + ": " + oItem.error;

                                    }).join("\n")
                                );

                            }

                        } catch (oError) {

                            MessageBox.error(
                                oError.message || "Bulk operation failed"
                            );

                        } finally {

                            oTable.setBusy(false);

                        }

                    }.bind(this)
                }
            );

        },


    });
});