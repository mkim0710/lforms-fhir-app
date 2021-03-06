var fb = angular.module('lformsApp');
fb.service('fhirService', [
  '$rootScope',
  '$q',
  '$http',
  '$window',
  function($rootScope, $q, $http, $window) {
    var thisService = this;

    // Currently selected patient
    thisService.currentPatient = null;

    // smart on fhir connection
    thisService.connection = null;
    // the fhir api handler
    thisService.fhir = null;

    // Current Questionnaire resource
    thisService.currentQuestionnaire = null;


    /**
     * Set the smart on fhir connection
     * @param connection a connection to smart on fhir service
     */
    thisService.setSmartConnection = function(connection) {
      thisService.connection = connection;
      //thisService.fhir = connection.patient.api;
      thisService.fhir = connection.api;

    };


    /**
     * Get the smart on fhir connection
     * @returns the smart on fhir connection or null
     */
    thisService.getSmartConnection = function() {
      return thisService.connection;
    };


    /**
     * Set the current Questionnaire resource
     * Data returned through an angular broadcast event.
     * @param q the selected Questionnaire resource
     */
    thisService.setCurrentQuestionnaire = function(q) {
      // reset current Questionnaire resource
      thisService.currentQuestionnaire = q;
      $rootScope.$broadcast('LF_FHIR_QUESTIONNAIRE_SELECTED', {resource: q});
    };


    /**
     * Get the current selected Questionnaire resource
     * @returns {null}
     */
    thisService.getCurrentQuestionnaire = function() {
      return thisService.currentQuestionnaire;
    };


    /**
     * Set the current selected patient
     * Data returned through an angular broadcast event.
     * @param patient the selected patient
     */
    thisService.setCurrentPatient = function(patient) {
      thisService.currentPatient = patient;

    };


    /**
     * Get the current selected patient
     * @returns {null}
     */
    thisService.getCurrentPatient = function() {
      return thisService.currentPatient;
    };

    /**
     * Get the patient's display name
     * @param patient optional, an FHIR Patient resource
     * @returns {string} a formatted patient name
     * @private
     */
    thisService.getPatientName = function(patient) {
      var currentPatient = patient ? patient : thisService.currentPatient;
      var name = "";
      if (currentPatient && currentPatient.name && currentPatient.name.length > 0) {
        if (currentPatient.name[0].given && currentPatient.name[0].family) {
          name = currentPatient.name[0].given[0] + " " + currentPatient.name[0].family;
        }
        else if (currentPatient.name[0].family) {
          name = currentPatient.name[0].family;
        }
        else if (currentPatient.name[0].given ) {
          name = currentPatient.name[0].given[0]
        }
      }
      return name;
    };


    /**
     * Get the patient's phone number
     * @param patient optional, an FHIR Patient resource
     * @returns {string} the first available phone number
     * @private
     */
    thisService.getPatientPhoneNumber = function(patient) {
      var currentPatient = patient ? patient : thisService.currentPatient;
      var phone = "";
      if (currentPatient && currentPatient.telecom) {
        for (var i=0, iLen=currentPatient.telecom.length; i<iLen; i++) {
          if (currentPatient.telecom[i].system==="phone" && currentPatient.telecom[i].value) {
            phone = currentPatient.telecom[i].use ? currentPatient.telecom[i].use + ": " + currentPatient.telecom[i].value :
              currentPatient.telecom[i].value;
            break;
          }
        }
      }
      return phone;
    };


    /**
     * Get FHIR pagination results using a link url in the current bundle
     *
     * @param resType - The FHIR bundle from which to extract the relation url.
     * @param relation - A string specifying the relation ('prev' | 'next')
     * @returns {Object} - FHIR resource bundle
     */
    thisService.getPage = function(resType, relation, url) {
      var baseUrl = $window.location.origin + '/fhir-api?';
      var url = url.replace(/^.*\/baseDstu3\?/, baseUrl);

      // if (resType === "QuestionnaireResponse") {
      //   url += "?_sort=-authored";
      // }
      // else if  (resType === "Questionnaire") {
      //   url += "?_sort=-date";
      // }

      var fn;
      if(relation === 'next') {
        fn = thisService.fhir.nextPage;
      }
      else if (relation === 'previous') {
        fn = thisService.fhir.prevPage;
      }

      var bundle = {
        "resourceType": "Bundle",
        "type": "searchset",
        "link": [
          {
            "relation": relation,
            "url": url
          }
        ]
      };

      fn({bundle: bundle})
        .then(function(response) {   // response.data is a searchset bundle
          if (resType === "Questionnaire") {
            $rootScope.$broadcast('LF_FHIR_QUESTIONNAIRE_LIST', response.data);
          }
          else if (resType === "QuestionnaireResponse") {
            $rootScope.$broadcast('LF_FHIR_QUESTIONNAIRERESPONSE_LIST', response.data);
          }
          // else if (resType === "DiagnosticReport") {
          //   $rootScope.$broadcast('LF_FHIR_DIAGNOSTICREPORT_LIST', response.data);
          // }
        }, function(error) {
          console.log(error);
        });

    };


    /**
     * Search patients by name
     * Data returned through an angular broadcast event.
     * @param searchText the search text for patient names
     * @returns {*}
     */
    thisService.searchPatientByName = function(searchText) {
      // md-autocomplete directive requires a promise to be returned
      return thisService.fhir.search({
        type: "Patient",
        query: {name: searchText},
        headers: {'Cache-Control': 'no-cache'}
      })
        .then(function(response) {
          // process data for md-autocomplete
          var patientList = [];
          if (response && response.data.entry) {
            for (var i=0, iLen=response.data.entry.length; i<iLen; i++) {
              var patient = response.data.entry[i].resource;
              patientList.push({
                name: thisService.getPatientName(patient),
                gender: patient.gender,
                dob: patient.birthDate,
                phone: thisService.getPatientPhoneNumber(patient),
                id: patient.id,
                resource: patient
              })
            }
          }

          // // it is actually not needed, since the returned list is handled directly in md-autocomplete
          // // use broadcasted event if the returned data needed to be handled in other controllers.
          // $rootScope.$broadcast('LF_FHIR_PATIENT_LIST', patientList);

          return patientList;
        }, function(error) {
          console.log(error);
        });
    };


    /**
     * Search questionnaires by name
     * Data returned through an angular broadcast event.
     * @param searchText the search text for patient names
     * @returns {*}
     */
    thisService.searchQuestionnaireByName = function(searchText) {
      // md-autocomplete directive requires a promise to be returned
      return thisService.fhir.search({
        type: "Questionnaire",
        query: {name: searchText},
        headers: {'Cache-Control': 'no-cache'}
      })
        .then(function(response) {
          // process data for md-autocomplete
          var qList = [];
          if (response && response.data.entry) {
            for (var i=0, iLen=response.data.entry.length; i<iLen; i++) {
              var q = response.data.entry[i].resource;
              qList.push({
                name: q.name,
                status: q.status,
                id: q.id,
                resource: q
              })
            }
          }

          return qList;
        }, function(error) {
          console.log(error);
        });
    };

    /**
     * Get a FHIR resource by resource ID
     * Data returned through an angular broadcast event.
     * @param resType FHIR resource type
     * @param resId FHIR resource ID
     */
    thisService.getFhirResourceById = function(resType, resId) {
      thisService.fhir.read({type: resType, id: resId})
        .then(function(response) {
          $rootScope.$broadcast('LF_FHIR_RESOURCE',
            {resType: resType, resource: response.data, resId: resId});
        }, function(error) {
          console.log(error);
        });
    };


    /**
     * Get the QuestionnaireResponse resource by id and its related Questionnaire resource
     * Data returned through an angular broadcast event.
     * @param resType FHIR resource type
     * @param resId FHIR resource ID
     */
    thisService.getMergedQQR = function(resType, resId) {
      thisService.fhir.search(
        {
          type: resType,
          query: {_id: resId, _include: 'QuestionnaireResponse:questionnaire'},
          headers: {'Cache-Control': 'no-cache'}
      })
        .then(function(response) {
          var result = {qResource: null, qrResource: null};

          // not found, might be deleted from FHIR server by other apps
          var resNum = response.data.entry.length;
          if (resNum === 0) {
          }
          // one or two resource found
          else if (resNum === 1 || resNum === 2) {
            for (var i=0; i<resNum; i++) {
              var res = response.data.entry[i].resource;
              if (res.resourceType === 'QuestionnaireResponse') {
                result.qrResource = res;
              }
              else if (res.resourceType === 'Questionnaire') {
                result.qResource = res;
              }
            }
          }
          $rootScope.$broadcast('LF_FHIR_MERGED_QQR', result);
        }, function(error) {
          console.log(error);
        });
    };


    /**
     * Create Questionnaire if it does not exist, and QuestionnaireResponse
     * Data returned through an angular broadcast event.
     * @param q the Questionnaire resource
     * @param qr the QuestionnaireResponse resource
     * @param extenstionType optional, for Questionnaire/QuestionnaireResponse it could be "SDC"
     */
    thisService.createQQR = function(q, qr, extensionType) {

      var queryJson = {identifier: "http://loinc.org|" + q.identifier[0].value};

      // check if a related Questionnaire exists
      thisService.fhir.search({
        type: "Questionnaire",
        query: queryJson,
        headers: {'Cache-Control': 'no-cache'}
      })
        .then(function success(resp){
          var bundle = resp.data;
          var count = (bundle.entry && bundle.entry.length) || 0;
          // found existing Questionnaires
          if (count > 0 ) {
            var oneQuestionnaireResource = bundle.entry[0].resource;
            var questionnaireResId = oneQuestionnaireResource.id;

            // update reference to Questionnaire in QuestionnaireResponse
            qr.questionnaire = {
              "reference": "Questionnaire/" + questionnaireResId
            };
            // create QuestionnaireResponse
            thisService.fhir.create({resource: qr})
              .then(function success(resp) {
                  $rootScope.$broadcast('LF_FHIR_RESOURCE_CREATED',
                    { resType: "QuestionnaireResponse",
                      resource: resp.data,
                      resId: resp.data.id,
                      qResId: questionnaireResId,
                      qName: q.name,
                      extensionType: extensionType
                    });
                },
                function error(error) {
                  console.log(error);
                });
          }
          // no Questionnaire found, create a new Questionnaire first
          else {
            thisService.fhir.create({resource: q})
              .then(function success(resp) {
                  var qResId = resp.data.id;
                  // then create QuestionnaireResponse
                  qr.questionnaire = {
                    "reference": "Questionnaire/" + qResId
                  };

                  thisService.fhir.create({resource: qr})
                    .then(function success(resp) {
                        $rootScope.$broadcast('LF_FHIR_RESOURCE_CREATED',
                          {
                            resType: "QuestionnaireResponse",
                            resource: resp.data,
                            resId: resp.data.id,
                            qResId: questionnaireResId,
                            qName: q.name,
                            extensionType: extensionType
                          });
                      },
                      function error(error) {
                        console.log(error);
                      });
                },
                function error(error) {
                  console.log(error);
                });
          }
        },
        function error(error) {
          console.log(error);
        });
    };


    /**
     * Create a FHIR resource
     * Data returned through an angular broadcast event.
     * @param resType FHIR resource type
     * @param resource the FHIR resource
     * @param extenstionType optional, for Questionnaire/QuestionnaireResponse it could be "SDC"
     */
    thisService.createFhirResource = function(resType, resource, extensionType) {
      thisService.fhir.create({resource: resource})
        .then(function success(response) {
          resource.id = response.data.id;
          $rootScope.$broadcast('LF_FHIR_RESOURCE_CREATED',
            {
              resType: resType,
              resource: response.data,
              resId: response.data.id,
              extensionType: extensionType
            });
        },
        function error(response) {
          console.log(response);
        });
    };


    /**
     * Update an FHIR resource
     * Data returned through an angular broadcast event.
     * @param resType FHIR resource type
     * @param resource the FHIR resource
     */
    thisService.updateFhirResource = function(resType, resource) {
      thisService.fhir.update({resource: resource})
        .then(function success(response) {
          $rootScope.$broadcast('LF_FHIR_RESOURCE_UPDATED',
            {resType: resType, resource: response.data, resId: resource.id});
        },
        function error(response) {
          console.log(response);
        });
    };


    /**
     * Delete an FHIR resource
     * Status returned through an angular broadcast event.
     * @param resType FHIR resource type
     * @param resId FHIR resource ID
     */
    thisService.deleteFhirResource = function(resType, resId) {

      thisService.fhir.delete({type: resType, id: resId})
        .then(function success(response) {
          // response.data === "OK"
          $rootScope.$broadcast('LF_FHIR_RESOURCE_DELETED',
            {resType: resType, resource: null, resId: resId});
        },
        function error(response) {
          console.log(response);
        });

    };


    /**
     * Get a Bundle with a DiagnosticReport resource and its all results Observation resources
     * @param resType FHIR resource type (should be DiagnosticReport)
     * @param resId FHIR resource ID
     * not used
     */
    thisService.getDRAndObxBundle = function(resType, resId) {
      thisService.fhir.search({
        type: 'DiagnosticReport',
        query: {
          _id: resId,
          _include: 'DiagnosticReport:result'
        },
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
        .then(function(response) {   // response.data is a searchset bundle
          $rootScope.$broadcast('LF_FHIR_DR_OBX_BUNDLE', response.data);
        }, function(error) {
          console.log(error);
        });
    };


    /**
     * Process a FHIR transaction bundle.
     * Within the bundle, each resource could have its own request method.
     * @param bundle a FHIR transaction bundel.
     */
    thisService.handleTransactionBundle = function(bundle) {
      thisService.fhir.transaction({bundle: bundle})
        .then(
          function success(response) {
            console.log('transaction succeeded');
            console.log(response);
          },
          function error() {
            console.log(response);

          })
    };


    /**
     * Get all QuestionnaireResponse resources of a patient
     * Data returned through an angular broadcast event.
     * @param pId the current patient's ID
     */
    thisService.getAllQRByPatientId = function(pId) {
      thisService.fhir.search({
        type: 'QuestionnaireResponse',
        query: {
          subject: 'Patient/' + pId,
          _include: 'QuestionnaireResponse:questionnaire',
          _sort: '-authored',
          _count: 10
        },
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
        .then(function(response) {   // response.data is a searchset bundle
          $rootScope.$broadcast('LF_FHIR_QUESTIONNAIRERESPONSE_LIST', response.data);
        }, function(error) {
          console.log(error);
        });
    };


    /**
     * Find the referred Questionnaire resource in a search set
     * @param searchSet an FHIR search set
     * @param qId the id of a Questionnaire resource
     * @returns {*}
     */
    thisService.findQuestionnaire = function(searchSet, qId) {
      var qRes = null;
      if (searchSet) {
        for (var i=0, iLen=searchSet.entry.length; i< iLen; i++) {
          var resource = searchSet.entry[i].resource;
          if (resource.resourceType === "Questionnaire" && resource.id === qId) {
            qRes = resource;
            break;
          }
        }
      }
      return qRes;
    };


    /**
     * Get all Questionnaire resources
     * Data returned through an angular broadcast event.
     */
    thisService.getAllQ = function() {

      thisService.fhir.search({
        type: 'Questionnaire',
        query: {
          _sort: '-date',
          _count: 10
        },
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
        .then(function(response) {   // response.data is a searchset bundle
          $rootScope.$broadcast('LF_FHIR_QUESTIONNAIRE_LIST', response.data);
        }, function(error) {
          console.log(error);
        });
    };

  }]);
