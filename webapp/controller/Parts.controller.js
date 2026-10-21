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
                pendingCountText: "Loading...",
                selectedCount: 0
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


        onSelectionChange: function () {

            var oTable = this.byId("partsApprovalTable");

            this.getView()
                .getModel("partsApprovalVM")
                .setProperty(
                    "/selectedCount",
                    oTable.getSelectedIndices().length
                );

        },

        _clearSelection: function () {

            this.byId("partsApprovalTable").clearSelection();

            this.getView()
                .getModel("partsApprovalVM")
                .setProperty("/selectedCount", 0);

        },

        /* ---------- search ---------- */
        onSearch: function () {
            this._clearSelection();
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
            this._clearSelection();
            this.byId("partsApprovalTable").getBinding("rows").refresh();
        },

        /* ---------- approve / reject via actions ---------- */

        onApproveSelected: function () {

            this._processSelectedParts(
                "approveMaster",
                "approve"
            );

        },

        onRejectSelected: function () {

            this._processSelectedParts(
                "rejectMaster",
                "reject"
            );

        },

        _processSelectedParts: async function (sAction, sOperation) {

            var oTable = this.byId("partsApprovalTable");
            var oModel = this.getView().getModel();
            var aIndices = oTable.getSelectedIndices();

            if (!aIndices.length) {

                MessageToast.show("Please select at least one Part");
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

            // Capture Part Codes before executing actions
            var aRecords;

            try {

                aRecords = await Promise.all(
                    aContexts.map(async function (oContext) {

                        return {
                            partCode: await oContext.requestProperty("partCode")
                        };

                    })
                );

            } catch (oError) {

                MessageBox.error(
                    "Unable to read selected Parts: " + oError.message
                );

                return;
            }

            if (aRecords.some(function (oRecord) {
                return !oRecord.partCode;
            })) {

                MessageBox.error(
                    "Part Code is missing for one or more selected records."
                );

                return;
            }

            MessageBox.confirm(
                "Are you sure you want to " +
                sOperation + " " +
                aRecords.length + " selected Part(s)?",
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
                                        "Parts"
                                    );

                                    oAction.setParameter(
                                        "recordKey",
                                        JSON.stringify({
                                            partCode: oRecord.partCode
                                        })
                                    );

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
                                        partCode: oRecord.partCode,
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
                                    " Part(s) successfully " +
                                    (sOperation === "approve"
                                        ? "approved"
                                        : "rejected")
                                );

                            } else {

                                MessageBox.warning(
                                    iSuccess + " succeeded, " +
                                    aFailed.length + " failed.\n\n" +
                                    aFailed.map(function (oItem) {

                                        return oItem.partCode +
                                            ": " + oItem.error;

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