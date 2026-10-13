sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/FilterType",
    "sap/m/MessageToast"
], function (Controller, JSONModel, Filter, FilterOperator, FilterType, MessageToast) {
    "use strict";

    return Controller.extend("vpamasterapproval.controller.MTOConfigurations", {

        onInit: function () {
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

        /* ---------- table: row numbers + pager state ---------- */

        onRowsUpdated: function () {
            var oTable = this.byId("mtoTable");
            var oBinding = oTable.getBinding("rows");
            if (!oBinding) {
                return;
            }

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
            var oTable = this.byId("mtoTable");
            oTable.getRowMode().setRowCount(Math.max(1, Math.min(this._iPageSize, iTotal - iStartRow)));
            oTable.setFirstVisibleRow(iStartRow);
        },

        _resetRows: function () {
            var oTable = this.byId("mtoTable");
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
            var sQuery = this._sQuery || "";
            var sKey = this.byId("mtoFieldFilterSelect").getSelectedKey();
            var aFilters = [];

            if (sQuery) {
                var aFields = sKey === "all" ? ["mtoModelCode", "referenceMTSModel_modelCode"] : [sKey];
                var aFieldFilters = aFields.map(function (sField) {
                    return new Filter(sField, FilterOperator.Contains, sQuery);
                });
                aFilters.push(new Filter({ filters: aFieldFilters, and: false }));
            }

            this._resetRows();
            this.byId("mtoTable").getBinding("rows").filter(aFilters, FilterType.Control);
        },

        onRefresh: function () {
            var oBinding = this.byId("mtoTable").getBinding("rows");

            if (!oBinding) {
                MessageToast.show("Table is not bound yet");
                return;
            }

            this._sQuery = "";
            this.byId("mtoSearchField").setValue("");
            this.byId("mtoFieldFilterSelect").setSelectedKey("all");
            this._resetRows();
            oBinding.filter([], FilterType.Control);

            try {
                oBinding.refresh();
                MessageToast.show("Data refreshed");
            } catch (oError) {
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

        onApprove: function (oEvent) {
            this._setApprovalStatus(oEvent.getSource().getBindingContext(), "APPROVED");
        },

        onReject: function (oEvent) {
            this._setApprovalStatus(oEvent.getSource().getBindingContext(), "REJECTED");
        },

        _setApprovalStatus: function (oContext, sStatus) {
            var that = this;
            oContext.setProperty("approvalStatus", sStatus)
                .then(function () {
                    MessageToast.show("Marked as " + that.formatStatusText(sStatus));
                    // the row no longer matches the SUBMITTED filter, so reload the list
                    that.byId("mtoTable").getBinding("rows").refresh();
                })
                .catch(function (oError) {
                    MessageToast.show("Update failed: " + oError.message);
                });
        }
    });
});