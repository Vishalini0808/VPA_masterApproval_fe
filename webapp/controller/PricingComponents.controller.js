
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/FilterType",
], function (
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
    MessageToast,
    MessageBox,
    FilterType
) {
    "use strict";

    return Controller.extend(
        "vpamasterapproval.controller.PricingComponents", {

        onInit: function () {

            var oViewModel = new JSONModel({

                pendingCountText: "Loading pending records...",
                selectedCount: 0

            });

            this.getView().setModel(
                oViewModel,
                "pricingCompApprovalVM"
            );

        },

        onRowsUpdated: function () {

            this._loadPendingCount();

        },

        _loadPendingCount: function () {

            var oTable = this.byId(
                "pricingCompApprovalTable"
            );

            var oBinding = oTable.getBinding("rows");

            var oViewModel = this.getView()
                .getModel("pricingCompApprovalVM");

            if (!oBinding) {
                return;
            }

            var iCount = oBinding.getLength();

            oViewModel.setProperty(
                "/pendingCountText",
                iCount + " records pending for approval"
            );

        },

        onSearch: function () {

            this._clearSelection();

            var sQuery = this.byId(
                "pricingCompApprovalSearchField"
            ).getValue().trim();

            var sField = this.byId(
                "pricingCompApprovalFieldFilterSelect"
            ).getSelectedKey();

            var oTable = this.byId(
                "pricingCompApprovalTable"
            );

            var oBinding = oTable.getBinding("rows");

            if (!oBinding) {
                return;
            }

            // Always show SUBMITTED records only

            var aFilters = [

                new Filter(
                    "approvalStatus",
                    FilterOperator.EQ,
                    "SUBMITTED"
                )

            ];

            if (sQuery) {

                var aSearchFilters = [];

                if (sField === "all") {

                    aSearchFilters = [

                        new Filter(
                            "regionCode",
                            FilterOperator.Contains,
                            sQuery
                        ),

                        new Filter(
                            "engineType",
                            FilterOperator.Contains,
                            sQuery
                        )

                    ];

                } else {

                    aSearchFilters.push(

                        new Filter(
                            sField,
                            FilterOperator.Contains,
                            sQuery
                        )

                    );

                }

                // OR condition for search fields

                aFilters.push(

                    new Filter({
                        filters: aSearchFilters,
                        and: false
                    })

                );

            }

            // Apply SUBMITTED + Search filter

            oBinding.filter(aFilters);

        },

        onRefresh: function () {
            this._clearSelection();

            var oTable = this.byId(
                "pricingCompApprovalTable"
            );

            var oBinding = oTable.getBinding("rows");

            if (!oBinding) {
                return;
            }

            oBinding.refresh();

            MessageToast.show(
                "Pricing Components refreshed"
            );

        },


        onSelectionChange: function () {

            var oTable = this.byId("pricingCompApprovalTable");

            this.getView()
                .getModel("pricingCompApprovalVM")
                .setProperty(
                    "/selectedCount",
                    oTable.getSelectedIndices().length
                );
        },

        _clearSelection: function () {

            this.byId("pricingCompApprovalTable").clearSelection();

            this.getView()
                .getModel("pricingCompApprovalVM")
                .setProperty("/selectedCount", 0);

        },

onApproveSelected: function () {
    this._processSelectedPricingComponents(
        "approveMaster",
        "approve"
    );
},

onRejectSelected: function () {
    this._processSelectedPricingComponents(
        "rejectMaster",
        "reject"
    );
},

_processSelectedPricingComponents: function (sAction, sOperation) {

    var oTable = this.byId("pricingCompApprovalTable");
    var oModel = this.getView().getModel();
    var aIndices = oTable.getSelectedIndices();

    if (!aIndices.length) {
        MessageToast.show("Please select at least one Pricing Component");
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

    // Composite primary key: regionCode + engineType
    var aRecords = aContexts.map(function (oContext) {
        return {
            regionCode: oContext.getProperty("regionCode"),
            engineType: oContext.getProperty("engineType")
        };
    });

    if (aRecords.some(function (oRecord) {
        return !oRecord.regionCode || !oRecord.engineType;
    })) {
        MessageBox.error(
            "Region Code or Engine Type is missing for a selected record."
        );
        return;
    }

    MessageBox.confirm(
        "Are you sure you want to " +
        sOperation + " " +
        aRecords.length + " selected Pricing Component(s)?",
        {
            title: sOperation === "approve"
                ? "Confirm Approval"
                : "Confirm Rejection",

            actions: [
                MessageBox.Action.YES,
                MessageBox.Action.NO
            ],

            emphasizedAction: sOperation === "approve"
                ? MessageBox.Action.YES
                : MessageBox.Action.NO,

            onClose: async function (sResult) {

                if (sResult !== MessageBox.Action.YES) {
                    return;
                }

                var iSuccess = 0;
                var aFailed = [];

                oTable.setBusy(true);

                try {

                    // One backend action call per selected record
                    for (const oRecord of aRecords) {

                        try {

                            var oAction = oModel.bindContext(
                                "/" + sAction + "(...)"
                            );

                            oAction.setParameter(
                                "entityName",
                                "PricingComponents"
                            );

                            oAction.setParameter(
                                "recordKey",
                                JSON.stringify({
                                    regionCode: oRecord.regionCode,
                                    engineType: oRecord.engineType
                                })
                            );

                            await oAction.execute();

                            // Check Boolean response from CAP
                            var oResult = await oAction
                                .getBoundContext()
                                .requestObject();

                            if (oResult && oResult.value === false) {
                                throw new Error("Backend returned false");
                            }

                            iSuccess++;

                        } catch (oError) {

                            aFailed.push({
                                regionCode: oRecord.regionCode,
                                engineType: oRecord.engineType,
                                error: oError.message
                            });

                        }

                    }

                    this._clearSelection();

                    // Refresh SUBMITTED records
                    var oBinding = oTable.getBinding("rows");

                    if (oBinding) {
                        oBinding.refresh();
                    }

                    if (aFailed.length === 0) {

                        MessageToast.show(
                            iSuccess +
                            " Pricing Component(s) successfully " +
                            (sOperation === "approve"
                                ? "approved"
                                : "rejected")
                        );

                    } else {

                        MessageBox.warning(
                            iSuccess + " succeeded, " +
                            aFailed.length + " failed.\n\n" +
                            aFailed.map(function (oItem) {
                                return oItem.regionCode +
                                    " (" + oItem.engineType + "): " +
                                    oItem.error;
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
