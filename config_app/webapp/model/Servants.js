sap.ui.define([], 
    function() {
    'use strict';
    
    return {
        _ReadData : function (oModel, sPath) {
            return new Promise(function(resolve, reject) {
                oModel.read(sPath, {
                    // filters : filters,
                    async : true,
                    success : function(oData, oResp) {
                        resolve(oData, oResp);
                    },
                    error : function(err){
                        reject(err);
                    }
                })
            });
        },

        _SubmitBatchData : function (oDataModel) {
            return new Promise(function (resolve, reject) {
                oDataModel.submitBatch(function (oResult) {
                    resolve(oResult.__batchResponses[0].__changeResponses);
                },
                function (err) {
                    reject(err);
                });
            });
        },
    }
});