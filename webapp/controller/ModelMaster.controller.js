sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/FilterType",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, Filter, FilterOperator, FilterType, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("vpamasterapproval.controller.ModelMaster", {

        onInit: function () {
            this.getView().setModel(
                new JSONModel({
                    count: 0
                }),
                "selection"
            );
            this._iPageSize = 10;
            this._sQuery = "";

            this.getView().setModel(new JSONModel({
                total: 0, from: 0, to: 0, page: 1, pages: 1,
                prevEnabled: false, nextEnabled: false,
                p1: 1, p2: 2, p3: 3,
                p1Visible: true, p2Visible: false, p3Visible: false,
                p1Type: "Emphasized", p2Type: "Transparent", p3Type: "Transparent"
            }), "pager");
        },

        onSelectionChange: function () {

            var oTable = this.byId("model");

            var iCount = oTable.getSelectedIndices().length;

            this.getView()
                .getModel("selection")
                .setProperty("/count", iCount);
        },
        onApproveSelected: function () {
            this._processSelectedModels("approveMaster", "approve");
        },

        onRejectSelected: function () {
            this._processSelectedModels("rejectMaster", "reject");
        },
        _processSelectedModels: function (sAction, sOperation) {

            var oTable = this.byId("model");
            var oModel = this.getView().getModel();

            var aIndices = oTable.getSelectedIndices();

            if (!aIndices.length) {
                MessageToast.show("Please select at least one model");
                return;
            }

            var aContexts = aIndices
                .map(function (iIndex) {
                    return oTable.getContextByIndex(iIndex);
                })
                .filter(Boolean);

            if (aContexts.length !== aIndices.length) {
                MessageBox.warning(
                    "Some selected records are still loading. Please try again."
                );
                return;
            }

            // Capture keys before updating because approved/rejected
            // records will disappear from the SUBMITTED table.
            var aModelCodes = aContexts.map(function (oContext) {
                return oContext.getProperty("modelCode");
            });

            MessageBox.confirm(
                "Are you sure you want to " +
                sOperation + " " +
                aModelCodes.length + " selected model(s)?",
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

                            // One backend action call per selected model
                            for (const sModelCode of aModelCodes) {

                                try {

                                    var oAction = oModel.bindContext(
                                        "/" + sAction + "(...)"
                                    );

                                    oAction.setParameter(
                                        "entityName",
                                        "Models"
                                    );

                                    oAction.setParameter(
                                        "recordKey",
                                        JSON.stringify({
                                            modelCode: sModelCode
                                        })
                                    );

                                    await oAction.execute();

                                    iSuccess++;

                                } catch (oError) {

                                    aFailed.push({
                                        modelCode: sModelCode,
                                        error: oError.message
                                    });

                                }
                            }

                            // Clear selected rows
                            oTable.clearSelection();

                            this.getView()
                                .getModel("selection")
                                .setProperty("/count", 0);

                            // Refresh submitted records
                            await oTable.getBinding("rows").refresh();

                            if (aFailed.length === 0) {

                                MessageToast.show(
                                    iSuccess +
                                    " model(s) successfully " +
                                    (sOperation === "approve"
                                        ? "approved"
                                        : "rejected")
                                );

                            } else {

                                MessageBox.warning(
                                    iSuccess + " succeeded, " +
                                    aFailed.length + " failed.\n\n" +
                                    aFailed.map(function (oItem) {
                                        return oItem.modelCode +
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
        _clearSelection: function () {

            this.byId("model").clearSelection();

            this.getView()
                .getModel("selection")
                .setProperty("/count", 0);
        },
        /* ---------- table: row numbers + pager state ---------- */

        onRowsUpdated: function () {
            var oTable = this.byId("model");
            var oBinding = oTable.getBinding("rows");
            if (!oBinding) {
                return;
            }

            // "#" column = position in the whole list
            oTable.getRows().forEach(function (oRow) {
                var oContext = oRow.getBindingContext();
                oRow.getCells()[0].setText(oContext ? String(oContext.getIndex() + 1) : "");
            });

            var iTotal = oBinding.getCount();
            if (iTotal === undefined) {
                iTotal = oBinding.getLength();
            }
            var iSize = this._iPageSize;
            var iFirst = oTable.getFirstVisibleRow();
            var iPages = Math.max(1, Math.ceil(iTotal / iSize));
            var iPage = Math.min(Math.floor(iFirst / iSize) + 1, iPages);
            var iStart = Math.min(Math.max(iPage - 1, 1), Math.max(1, iPages - 2));

            var oData = {
                total: iTotal,
                from: iTotal ? iFirst + 1 : 0,
                to: Math.min(iFirst + iSize, iTotal),
                page: iPage,
                pages: iPages,
                prevEnabled: iPage > 1,
                nextEnabled: iPage < iPages
            };
            [0, 1, 2].forEach(function (i) {
                var n = iStart + i;
                oData["p" + (i + 1)] = n;
                oData["p" + (i + 1) + "Visible"] = n <= iPages;
                oData["p" + (i + 1) + "Type"] = n === iPage ? "Emphasized" : "Transparent";
            });
            this.getView().getModel("pager").setData(oData);
        },

        /* ---------- paging ---------- */

        _goToPage: function (iPage) {
            var oPager = this.getView().getModel("pager");
            var iPages = oPager.getProperty("/pages");
            var iTotal = oPager.getProperty("/total");
            iPage = Math.min(Math.max(iPage, 1), iPages);

            var iStartRow = (iPage - 1) * this._iPageSize;
            var oTable = this.byId("model");
            // the last page may have fewer rows than the page size
            oTable.getRowMode().setRowCount(Math.max(1, Math.min(this._iPageSize, iTotal - iStartRow)));
            oTable.setFirstVisibleRow(iStartRow);
        },

        _resetRows: function () {
            var oTable = this.byId("model");
            oTable.getRowMode().setRowCount(this._iPageSize);
            oTable.setFirstVisibleRow(0);
        },

        onFirstPage: function () {
            this._goToPage(1);
        },

        onPreviousPage: function () {
            this._goToPage(this.getView().getModel("pager").getProperty("/page") - 1);
        },

        onNextPage: function () {
            this._goToPage(this.getView().getModel("pager").getProperty("/page") + 1);
        },

        onLastPage: function () {
            this._goToPage(this.getView().getModel("pager").getProperty("/pages"));
        },

        onPagePress: function (oEvent) {
            this._goToPage(parseInt(oEvent.getSource().getText(), 10));
        },

        onItemsPerPageChange: function (oEvent) {
            this._iPageSize = parseInt(oEvent.getParameter("selectedItem").getKey(), 10);
            this._resetRows();
            this.onRowsUpdated();
        },

        /* ---------- search / refresh ---------- */

        onSearch: function (oEvent) {
            this._sQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query") || "";
            this._applyFilter();
        },

        onFieldFilterChange: function () {
            this._applyFilter();
        },

        _applyFilter: function () {
            this._clearSelection();
            var sQuery = this._sQuery || "";
            var sKey = this.byId("fieldFilterSelect").getSelectedKey();
            var aFilters = [];

            if (sQuery) {
                var aFields = sKey === "all" ? ["modelCode", "modelDescription", "engineType"] : [sKey];
                var aFieldFilters = aFields.map(function (sField) {
                    return new Filter(sField, FilterOperator.Contains, sQuery);
                });
                aFilters.push(new Filter({ filters: aFieldFilters, and: false }));
            }

            this._resetRows();
            // Control filters are combined (AND) with the SUBMITTED filter set in the view
            this.byId("model").getBinding("rows").filter(aFilters, FilterType.Control);
        },

        onRefresh: function () {
            this._clearSelection();
            var oBinding = this.byId("model").getBinding("rows");

            if (!oBinding) {
                MessageToast.show("Table is not bound yet");
                return;
            }

            this._sQuery = "";
            this.byId("modelSearchField").setValue("");
            this.byId("fieldFilterSelect").setSelectedKey("all");
            this._resetRows();
            oBinding.filter([], FilterType.Control);

            try {
                oBinding.refresh();
                MessageToast.show("Data refreshed");
            } catch (oError) {
                // OData V4 refuses to refresh while there are pending changes
                MessageToast.show("Refresh failed: " + oError.message);
            }
        },

        /* ---------- status badge ---------- */

        formatStatusText: function (sStatus) {
            return sStatus ? sStatus.charAt(0).toUpperCase() + sStatus.slice(1).toLowerCase() : "";
        },

        formatStatusState: function (sStatus) {
            switch ((sStatus || "").toUpperCase()) {
                case "SUBMITTED": return "Warning";
                case "APPROVED": return "Success";
                case "REJECTED": return "Error";
                default: return "None";
            }
        },

        /* ---------- approve / reject ---------- */

        // onApprove: function (oEvent) {
        //     this._setApprovalStatus(oEvent.getSource().getBindingContext(), "APPROVED");
        // },

        // onReject: function (oEvent) {
        //     this._setApprovalStatus(oEvent.getSource().getBindingContext(), "REJECTED");
        // },

        // _setApprovalStatus: function (oContext, sStatus) {
        //     var that = this;
        //     oContext.setProperty("approvalStatus", sStatus)
        //         .then(function () {
        //             MessageToast.show("Marked as " + that.formatStatusText(sStatus));
        //             // the row no longer matches the SUBMITTED filter, so reload the list
        //             that.byId("model").getBinding("rows").refresh();
        //         })
        //         .catch(function (oError) {
        //             MessageToast.show("Update failed: " + oError.message);
        //         });
        // }
    });
});