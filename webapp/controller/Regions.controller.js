
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast"
], function (
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
    MessageToast
) {
    "use strict";

    return Controller.extend("vpamasterapproval.controller.Regions", {

        onInit: function () {

            var oViewModel = new JSONModel({

                pendingCountText: "Loading pending records..."

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

            var oTable = this.byId("regionApprovalTable");

            var oBinding = oTable.getBinding("rows");

            if (!oBinding) {
                return;
            }

            oBinding.refresh();

            MessageToast.show("Region Master refreshed");

        },

        onApprove: function (oEvent) {

            var oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                MessageBox.error("Unable to identify selected Region.");
                return;
            }

            var sRegionCode = oContext.getProperty("regionCode");

            MessageBox.confirm(
                "Are you sure you want to approve Region " + sRegionCode + "?",
                {
                    title: "Confirm Approval",

                    actions: [
                        MessageBox.Action.YES,
                        MessageBox.Action.NO
                    ],

                    emphasizedAction: MessageBox.Action.YES,

                    onClose: function (sAction) {

                        if (sAction === MessageBox.Action.YES) {

                            this._updateApprovalStatus(
                                oEvent,
                                "approveMaster",
                                "approve"
                            );

                        }

                    }.bind(this)
                }
            );

        },

        onReject: function (oEvent) {

            var oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                MessageBox.error("Unable to identify selected Region.");
                return;
            }

            var sRegionCode = oContext.getProperty("regionCode");

            MessageBox.confirm(
                "Are you sure you want to reject Region " + sRegionCode + "?",
                {
                    title: "Confirm Rejection",

                    actions: [
                        MessageBox.Action.YES,
                        MessageBox.Action.NO
                    ],

                    emphasizedAction: MessageBox.Action.NO,

                    onClose: function (sAction) {

                        if (sAction === MessageBox.Action.YES) {

                            this._updateApprovalStatus(
                                oEvent,
                                "rejectMaster",
                                "reject"
                            );

                        }

                    }.bind(this)
                }
            );

        },

        _updateApprovalStatus: async function (
            oEvent,
            sAction,
            sOperation
        ) {

            var oButton = oEvent.getSource();

            // Get selected row context
            var oContext = oButton.getBindingContext();

            if (!oContext) {

                MessageBox.error(
                    "Unable to identify selected Region."
                );

                return;
            }

            var oRegion = oContext.getObject();

            var sRegionCode = oRegion.regionCode;

            if (!sRegionCode) {

                MessageBox.error(
                    "Region Code is missing."
                );

                return;
            }

            var oModel = oContext.getModel();

            var oTable = this.byId("regionApprovalTable");

            try {

                oButton.setEnabled(false);

                // Bind common unbound CAP action
                var oAction = oModel.bindContext(
                    "/" + sAction + "(...)"
                );

                // Set action parameters
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

                // Execute action
                await oAction.execute();

                // Read Boolean result returned by CAP
                var oResult = await oAction
                    .getBoundContext()
                    .requestObject();

                if (oResult && oResult.value === false) {
                    throw new Error(
                        "The " + sOperation + " action was unsuccessful."
                    );
                }

                MessageToast.show(
                    "Region " + sRegionCode +
                    " " +
                    (sOperation === "approve"
                        ? "approved"
                        : "rejected") +
                    " successfully"
                );

                // Refresh table
                var oBinding = oTable.getBinding("rows");

                if (oBinding) {
                    oBinding.refresh();
                }

            } catch (oError) {

                console.error(
                    "Region " + sOperation + " failed:",
                    oError
                );

                MessageBox.error(
                    oError.message ||
                    "Unable to " + sOperation + " Region."
                );

            } finally {

                oButton.setEnabled(true);

            }

        }

    });

});
