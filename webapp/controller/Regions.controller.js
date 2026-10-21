
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/ui/model/FilterType",
    "sap/m/MessageBox"
], function (
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
    MessageToast,
    FilterType,
    MessageBox
) {
    "use strict";

    return Controller.extend("vpamasterapproval.controller.Regions", {

        onInit: function () {

            var oViewModel = new JSONModel({

                pendingCountText: "Loading pending records...",
                selectedCount: 0

            });

            this.getView().setModel(
                oViewModel,
                "regionApprovalVM"
            );

        },

        onRowsUpdated: function () {

            this._loadPendingCount();

        },

        _loadPendingCount: function () {

            var oTable = this.byId("regionApprovalTable");

            var oBinding = oTable.getBinding("rows");

            var oViewModel = this.getView()
                .getModel("regionApprovalVM");

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

            var sQuery = this.byId("regionApprovalSearchField")
                .getValue()
                .trim();

            var sField = this.byId("regionApprovalFieldFilterSelect")
                .getSelectedKey();

            var oTable = this.byId("regionApprovalTable");

            var oBinding = oTable.getBinding("rows");

            if (!oBinding) {
                return;
            }

            // Always display only SUBMITTED records

            var aFilters = [

                new Filter(
                    "status",
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
                            "regionName",
                            FilterOperator.Contains,
                            sQuery
                        ),

                        new Filter(
                            "rtoBasis",
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

                // OR condition between search fields

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

            var oTable = this.byId("regionApprovalTable");

            var oBinding = oTable.getBinding("rows");

            if (!oBinding) {
                return;
            }

            oBinding.refresh();

            MessageToast.show("Region Master refreshed");

        },

        onSelectionChange: function () {

            var oTable = this.byId("regionApprovalTable");

            this.getView()
                .getModel("regionApprovalVM")
                .setProperty(
                    "/selectedCount",
                    oTable.getSelectedIndices().length
                );
        },

        _clearSelection: function () {

            this.byId("regionApprovalTable").clearSelection();

            this.getView()
                .getModel("regionApprovalVM")
                .setProperty("/selectedCount", 0);
        },

        onApproveSelected: function () {
            this._processSelectedRegions("approveMaster", "approve");
        },

        onRejectSelected: function () {
            this._processSelectedRegions("rejectMaster", "reject");
        },

        _processSelectedRegions: function (sAction, sOperation) {

            var oTable = this.byId("regionApprovalTable");
            var oModel = this.getView().getModel();
            var aIndices = oTable.getSelectedIndices();

            if (!aIndices.length) {
                MessageToast.show("Please select at least one Region");
                return;
            }

            var aContexts = aIndices.map(function (iIndex) {
                return oTable.getContextByIndex(iIndex);
            });

            if (aContexts.some(function (oContext) {
                return !oContext;
            })) {
                MessageBox.warning("Some selected records are still loading.");
                return;
            }

            var aRegionCodes = aContexts.map(function (oContext) {
                return oContext.getProperty("regionCode");
            });

            if (aRegionCodes.some(function (sCode) {
                return !sCode;
            })) {
                MessageBox.error("Region Code is missing.");
                return;
            }

            MessageBox.confirm(
                "Are you sure you want to " +
                sOperation + " " +
                aRegionCodes.length + " selected Region(s)?",
                {
                    title: "Confirm " + sOperation,

                    onClose: async function (sResult) {

                        if (sResult !== MessageBox.Action.OK) {
                            return;
                        }

                        var iSuccess = 0;
                        var aFailed = [];

                        oTable.setBusy(true);

                        try {

                            for (const sRegionCode of aRegionCodes) {

                                try {

                                    var oAction = oModel.bindContext(
                                        "/" + sAction + "(...)"
                                    );

                                    oAction.setParameter(
                                        "entityName",
                                        "Regions"
                                    );

                                    oAction.setParameter(
                                        "recordKey",
                                        JSON.stringify({
                                            regionCode: sRegionCode
                                        })
                                    );

                                    await oAction.execute();

                                    var oResult = await oAction
                                        .getBoundContext()
                                        .requestObject();

                                    if (oResult && oResult.value === false) {
                                        throw new Error("Backend returned false");
                                    }

                                    iSuccess++;

                                } catch (oError) {

                                    aFailed.push({
                                        regionCode: sRegionCode,
                                        error: oError.message
                                    });

                                }
                            }

                            this._clearSelection();

                            oTable.getBinding("rows").refresh();

                            if (aFailed.length === 0) {

                                MessageToast.show(
                                    iSuccess + " Region(s) successfully " +
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
                                            ": " + oItem.error;
                                    }).join("\n")
                                );

                            }

                        } catch (oError) {

                            MessageBox.error(oError.message);

                        } finally {

                            oTable.setBusy(false);

                        }

                    }.bind(this)
                }
            );
        },

    });

});
