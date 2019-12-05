/* Restores original tab name if the loading process failed due to some reason and the tab contains the loading counter */
function restoreCurrentTabName() {

    var key = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getName();
    var regex = / \(.*\)$/gi;

    key = key.replace(regex, '');

    SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().setName(key);
    return key;

}

function getLoadingProcessInfo(){
  //return Math.round(Math.random() * 100);
  var currentProgress = {};
  currentProgress["progress"] = userProperties.getProperty('loadingProcessProgress');
  currentProgress["step"] = userProperties.getProperty('loadingProcessStep');
  currentProgress["error"] = userProperties.getProperty('loadingProcessError');
  
  return currentProgress;
}


function resetLoadingProcessProgress() {
    updateLoadingProcessProgress(0);
}

function completeLoadingProcessProgress() {
    updateLoadingProcessProgress(100);
}

function updateLoadingProcessProgress(currentProcessProgress) {
    loadingProcessProgress = currentProcessProgress;
    userProperties.setProperty('loadingProcessProgress', loadingProcessProgress);
}

function resetLoadingProcessStep() {
    setLoadingProcessStep("Just started");
}

function setLoadingProcessStep(step) {
    userProperties.setProperty('loadingProcessStep', step);
}

function completeLoadingProcessStep() {
    setLoadingProcessStep("Just finished. You can close the window and check records in Vlocity");
}

function resetLoadingProcessError() {
    setLoadingProcessError(false);
}

function raiseLoadingProcessError() {
    setLoadingProcessError(true);
}

function setLoadingProcessError(error) {
    userProperties.setProperty('loadingProcessError', error);
}
  
/* The function strips out leading sequential number from a string, if used. 
* The leading sequential number is assumed to be separated from the main string part with a space
* Examples:
* "01. Offerings"   > "Offerings"
* "1216. Offerings" > "Offerings"
* "Offerings Test"  > "Offerings Test"
*/

function removeLeadingNumber(stringValue) {
    var regex = /[0-9]*\.* /gi;
    stringValue = stringValue.replace(regex, '');
    return stringValue;
}


function regenerateJsonAttributes() {
  var activeRange = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getActiveRange();
  var activeRangeValues = activeRange.getValues();  
  var selectionWidth = activeRange.getLastColumn();
  var tableWidth = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getLastColumn();
  var VIP_PREFIX = '/services/apexrest/vlocity_cmt/v1/integrationprocedure/';
  var vipName = 'EPC_RegenerateJSONAttributes';
  var vipEndpoint = VIP_PREFIX + vipName;
  var inputParameters = {};
  var productCodes = [];
  
  if (selectionWidth != tableWidth) {
    operationNotification(
      "Info",
      "\nTo regenerate JSONAttributes for products:\n\n " +  
      " 1. Navigate to the Offerings tab\n" +
      " 2. Select entire rows\n" + 
      " 3. Start the prcedure\n" + 
      "\nThe field will be regenerated only for the selected product records"
    );
    return;
  }
  
  for (i = 0; i < activeRange.getValues().length; i++) {
    productCodes.push(activeRangeValues[i][1]);
  }
  
  inputParameters['productCodes'] = productCodes;
  
  var payload = JSON.stringify(inputParameters);
  var result = invokeVipByName(vipName, payload);
  
  return result;
}

function regenerateJsonAttributesForAllProducts() {
  var OFFERINGS_TAB_NAME = "Offerings";
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(OFFERINGS_TAB_NAME);
  var dataRange = sheet.getDataRange();
  var recordsCount = dataRange.getNumRows();
  
  Logger.log('*** ' + recordsCount);
  if (recordsCount > 50) {
    operationNotification(
      "Info",
      "The operation supports up to 150 products at this moment.\n " +  
      "If you have more than 150 rows - update JSONAttribute in chunks manually"
    );
    return;
  }
  
  var VIP_PREFIX = '/services/apexrest/vlocity_cmt/v1/integrationprocedure/';
  var vipName = 'EPC_RegenerateJSONAttributes';
  var vipEndpoint = VIP_PREFIX + vipName;
  var inputParameters = {};
  var productCodes = [];
  var dataValues = dataRange.getValues();
  
  for (i = 0; i < dataValues.length; i++) {
    productCodes.push(dataValues[i][1]);
  }
  
  inputParameters['productCodes'] = productCodes;
  
  var payload = JSON.stringify(inputParameters);
  var result = invokeVipByName(vipName, payload);
  
  return result;
}


function invokeVipByName_Test() {
  var vipName = 'EPC_LoadGenericEPCDefinitions';
  var payload = {};
  payload['dataRaptorName'] = 'EPC on Steroids_Export All Offerings';
  return invokeVipByName(vipName, JSON.stringify(payload));
}

function invokeVipByName(vipName, payload) {
    var VIP_PREFIX = '/services/apexrest/vlocity_cmt/v1/integrationprocedure/';
    var vipEndpoint = VIP_PREFIX + vipName;
    var accessTokenObj = retrieveStoredAccessToken();

    if (!accessTokenObj) {
        Logger.log('Error: Access token should be generated first');

        logProgress(
            sheetName,
            "Process Error",
            "Access token should be generated first. Check the Settings tab"
        );

        operationNotification('Operation failed', 'Access token should be generated first. Check the Settings tab');
        return;
    }

    var accessToken = accessTokenObj.accessToken;
    var url = accessTokenObj.instanceUrl + vipEndpoint;

    var options = {
        'method': 'post',
        'contentType': 'application/json',
        'payload': payload,
        'muteHttpExceptions': true,
        'headers': {
            'Authorization': 'Bearer ' + accessToken
        },
        'escaping': false
    };

    Logger.log('*** invokeVipByName request:' + JSON.stringify(UrlFetchApp.getRequest(url, options)));

    logProgress(
        vipName,
        "Request Payload",
        payload);

    var response = UrlFetchApp.fetch(url, options);
    Logger.log('*** invokeVipByName response:' + response);

    logProgress(
        vipName,
        "Response Payload",
        response);

    //error processing
    var responseAsJson = JSON.parse(response);
    var errorDetected = false;

    if (responseAsJson) {
        var result = JSON.stringify(responseAsJson['Result']);
        if (result) {
            var hasErrors = JSON.stringify(responseAsJson['Result']['hasErrors']);
            Logger.log('*** hasErrors: ' + hasErrors);
            errorDetected = hasErrors;
        } else {
            errorDetected = true;
        }
    } else {
        errorDetected = true;
    }

    if (errorDetected == true) {
        logProgress(
            vipName,
            "Process Error",
            "An error detected while invoking the integration procedure. Review the logs for more details");
        return STRING_EMPTY_STRING_CONST;
    }

    logProgress(
        vipName,
        "Process Info",
        "Invokation process is completed successfully");

    return JSON.stringify(responseAsJson['Result']['returnResultsData']);
}

function clearPlatformCache() {
  var VIP_PREFIX = '/services/apexrest/vlocity_cmt/v1/integrationprocedure/';
  var vipName = 'EPC_ClearPlatformCache';
  var vipEndpoint = VIP_PREFIX + vipName;
  var inputParameters = {};
  
  var payload = JSON.stringify(inputParameters);
  var result = invokeVipByName(vipName, payload);
  
  return result;
}



function regenerateLayoutsForCheckedObjectTypes() {
    var activeSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
    if (activeSheet.getName() != 'Object Types') {
      operationNotification(
        "Info",
        "\nTo regenerate layouts for object types:\n\n " +  
        " 1. Navigate to the Object Types tab\n" +
        " 2. Check object types to regenerate layouts for\n" + 
        " 3. Start the procedure\n" + 
        "\nThe layouts will be regenerated (removed and recreated) only for the selected object types records"
      );
      return;
    }
  
    var objectTypesData = exportRowsOfActiveSheetAsJson(CONST_EXPORT_SCOPE_ENUM.INCLUDE_ONLY_CHECKED);
    Logger.log('*** ' + JSON.stringify(objectTypesData));
  
    if (!objectTypesData) {
      operationNotification(
        "Info",
        "\nTo regenerate layouts for object types:\n\n " +  
        " 1. Navigate to the Object Types tab\n" +
        " 2. Check object types to regenerate layouts for\n" + 
        " 3. Start the procedure\n" + 
        "\nThe layouts will be regenerated (removed and recreated) only for the selected object types records"
      );
      return;
    }
  
    regenerateLayouts(objectTypesData);
}

function regenerateLayouts(objectTypesData) {
    var vipName = 'EPC_RegenerateLayoutsForObjectType';
    var objectTypesArray = objectTypesData["Object Types"];
  
    for (i = 0; i < objectTypesArray.length; i++) {
      var singleItemPayload = {};
      singleItemPayload['targetObjectTypeName'] = objectTypesArray[i]["Object Type"];
      Logger.log('*** Regenerating layout for  ' + JSON.stringify(singleItemPayload));
      logProgress(
            "Object Types (Layouts)",
            "Info",
            "Regenerating layout for " + objectTypesArray[i]["Object Type"]
        );
      invokeVipByName(vipName, JSON.stringify(singleItemPayload));
    }
    
}

function viewScriptProperties() {
  var keys = PropertiesService.getScriptProperties().getKeys();
  
  for (var i = 0; i < keys.length; i++) {
    Logger.log('*** ' + keys[i] + ': ' + PropertiesService.getScriptProperties()[keys[i]]);
  }
}

function shortenInstanceUrl(instanceUrl) {
  
  if (instanceUrl) {
    var tag = instanceUrl.match(/https:\/\/(.*?)\./);
    if (tag) {
      Logger.log('*** shortenInstanceUrl: ' + tag[1]);
      return tag[1];
    } else {
      return instanceUrl;
    }
    
  } else {
    return "Error: nothing to shorten here";
  }
}

/* The function checks if a propery has a non-empty/non-undefined value */
function isScriptPropertySet(propertyName) {
  var isPropertySet = false;
  var propertyValue = scriptProperties.getProperty(propertyName);
  if (propertyValue !== null &&
      propertyValue !== undefined &&
      propertyValue !== "undefined" &&
      propertyValue !== "") {
    isPropertySet = true;
  } 
  
  return isPropertySet;
}

/* The function checks if access token and instance URL are set */
function isConnectedToSalesforce() {
  var isConnected = false;
  
  if (isScriptPropertySet(CONST_ACCESS_TOKEN_PROPERTY_NAME) && 
      isScriptPropertySet(CONST_INSTANCE_URL_PROPERTY_NAME)) {
    isConnected = true;
  } 
  
  return isConnected;
}

/* The function generates UUID, credit to https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript */

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/* The function verifies that properties for authorization are properly set */

function areAuthorizationProperiesSet() {
  if (!customerKey || customerKey === "PUT_YOUR_VALUE_HERE") return false;
  if (!customerSecret || customerSecret === "PUT_YOUR_VALUE_HERE") return false;
  if (!organizationType || organizationType === "PUT_YOUR_VALUE_HERE") return false;
  
  return true;
}




