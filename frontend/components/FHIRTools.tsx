import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface FHIRPatient {
  id: string;
  name: string;
  gender?: string;
  birthDate?: string;
  address?: any;
  contact?: string;
}

interface FHIRMedication {
  id: string;
  code?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  status?: string;
  description?: string;
}

interface FHIRResource {
  resourceType: string;
  id: string;
  [key: string]: any;
}

interface FHIRToolsProps {
  onToolExecution: (toolName: string, params: any) => Promise<any>;
}

export default function FHIRTools({ onToolExecution }: FHIRToolsProps) {
  const [patientId, setPatientId] = useState<string>('');
  const [searchResourceType, setSearchResourceType] = useState<string>('Patient');
  const [searchParams, setSearchParams] = useState<string>('_count=5');
  const [patients, setPatients] = useState<FHIRPatient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<FHIRPatient | null>(null);
  const [medications, setMedications] = useState<FHIRMedication[]>([]);
  const [resources, setResources] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<FHIRResource[]>([]);

  // Fetch available FHIR resources when the component mounts
  useEffect(() => {
    fetchFHIRResources();
  }, []);

  const fetchFHIRResources = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await onToolExecution('list_fhir_resources', {});
      if (Array.isArray(result)) {
        setResources(result);
      } else if (typeof result === 'string') {
        try {
          const parsedResult = JSON.parse(result);
          if (Array.isArray(parsedResult)) {
            setResources(parsedResult);
          }
        } catch (e) {
          setError('Failed to parse resources list');
        }
      }
    } catch (err) {
      setError(`Error fetching resources: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = parseParamsString(searchParams);
      const result = await onToolExecution('search_fhir_resources', {
        resource_type: 'Patient',
        params: params
      });

      let patientList: FHIRPatient[] = [];
      if (typeof result === 'string') {
        try {
          const parsedResult = JSON.parse(result);
          if (parsedResult.entry && Array.isArray(parsedResult.entry)) {
            patientList = parsedResult.entry.map((entry: any) => {
              const resource = entry.resource;
              let name = 'Unknown';
              
              if (resource.name && resource.name.length > 0) {
                const nameObj = resource.name[0];
                name = [
                  nameObj.given ? nameObj.given.join(' ') : '',
                  nameObj.family || ''
                ].filter(Boolean).join(' ');
              }
              
              return {
                id: resource.id,
                name: name.trim() || 'Unknown',
                gender: resource.gender || 'unknown',
                birthDate: resource.birthDate || 'unknown'
              };
            });
          }
        } catch (e) {
          console.error('Failed to parse patient search results:', e);
        }
      } else if (result.entry && Array.isArray(result.entry)) {
        patientList = result.entry.map((entry: any) => {
          const resource = entry.resource;
          let name = 'Unknown';
          
          if (resource.name && resource.name.length > 0) {
            const nameObj = resource.name[0];
            name = [
              nameObj.given ? nameObj.given.join(' ') : '',
              nameObj.family || ''
            ].filter(Boolean).join(' ');
          }
          
          return {
            id: resource.id,
            name: name.trim() || 'Unknown',
            gender: resource.gender || 'unknown',
            birthDate: resource.birthDate || 'unknown'
          };
        });
      }
      
      setPatients(patientList);
      setSearchResults([]); // Clear other search results
    } catch (err) {
      setError(`Error searching patients: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSelect = async (patient: FHIRPatient) => {
    setSelectedPatient(patient);
    fetchPatientDemographics(patient.id);
    fetchMedications(patient.id);
  };

  const fetchPatientDemographics = async (id: string) => {
    setLoading(true);
    try {
      const result = await onToolExecution('get_patient_demographics', {
        patient_id: id
      });
      
      if (typeof result === 'string') {
        try {
          const parsedResult = JSON.parse(result);
          setSelectedPatient(prevPatient => ({
            ...(prevPatient || { id, name: 'Unknown' }),
            ...parsedResult
          }));
        } catch (e) {
          console.error('Failed to parse patient demographics:', e);
        }
      } else {
        setSelectedPatient(prevPatient => ({
          ...(prevPatient || { id, name: 'Unknown' }),
          ...result
        }));
      }
    } catch (err) {
      setError(`Error fetching patient demographics: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchMedications = async (id: string) => {
    setLoading(true);
    try {
      const result = await onToolExecution('get_medication_list', {
        patient_id: id
      });
      
      let medicationList: FHIRMedication[] = [];
      if (typeof result === 'string') {
        try {
          const parsedResult = JSON.parse(result);
          if (Array.isArray(parsedResult)) {
            medicationList = parsedResult;
          }
        } catch (e) {
          console.error('Failed to parse medications:', e);
        }
      } else if (Array.isArray(result)) {
        medicationList = result;
      }
      
      setMedications(medicationList);
    } catch (err) {
      setError(`Error fetching medications: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneralSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = parseParamsString(searchParams);
      const result = await onToolExecution('search_fhir_resources', {
        resource_type: searchResourceType,
        params: params
      });

      let resourceList: FHIRResource[] = [];
      if (typeof result === 'string') {
        try {
          const parsedResult = JSON.parse(result);
          if (parsedResult.entry && Array.isArray(parsedResult.entry)) {
            resourceList = parsedResult.entry.map((entry: any) => entry.resource);
          }
        } catch (e) {
          console.error('Failed to parse search results:', e);
        }
      } else if (result.entry && Array.isArray(result.entry)) {
        resourceList = result.entry.map((entry: any) => entry.resource);
      }
      
      setSearchResults(resourceList);
      setPatients([]); // Clear patient results
      setSelectedPatient(null);
      setMedications([]);
    } catch (err) {
      setError(`Error searching resources: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to parse URL parameter string into an object
  const parseParamsString = (paramString: string): Record<string, string> => {
    const params: Record<string, string> = {};
    if (!paramString.trim()) return params;
    
    paramString.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      if (key && value) {
        params[key.trim()] = value.trim();
      }
    });
    return params;
  };

  // Format JSON for display
  const formatJSON = (data: any): string => {
    try {
      return JSON.stringify(data, null, 2);
    } catch (e) {
      return String(data);
    }
  };

  return (
    <div className="w-full">
      <Tabs defaultValue="patient">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="patient">Patient Data</TabsTrigger>
          <TabsTrigger value="search">Resource Search</TabsTrigger>
        </TabsList>

        <TabsContent value="patient" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Patient Search</CardTitle>
              <CardDescription>Search for patients in the FHIR database</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Parameters (e.g., name=Smith&_count=5)"
                    value={searchParams}
                    onChange={(e) => setSearchParams(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handlePatientSearch}
                    disabled={loading}
                    className="min-w-24"
                  >
                    {loading ? 'Searching...' : 'Search'}
                  </Button>
                </div>

                {error && (
                  <div className="p-2 bg-red-100 border border-red-400 text-red-700 rounded">
                    {error}
                  </div>
                )}

                {patients.length > 0 && (
                  <div className="border rounded-md">
                    <div className="p-2 bg-gray-100 font-medium border-b">
                      Found {patients.length} Patients
                    </div>
                    <div className="divide-y">
                      {patients.map(patient => (
                        <div 
                          key={patient.id}
                          className="p-2 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                          onClick={() => handlePatientSelect(patient)}
                        >
                          <div>
                            <div className="font-medium">{patient.name}</div>
                            <div className="text-sm text-gray-600">
                              ID: {patient.id} • Gender: {patient.gender} • DOB: {patient.birthDate}
                            </div>
                          </div>
                          <Button variant="outline" size="sm">
                            Select
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedPatient && (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle>Patient Details</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div>
                            <span className="font-medium">Name:</span> {selectedPatient.name}
                          </div>
                          <div>
                            <span className="font-medium">ID:</span> {selectedPatient.id}
                          </div>
                          <div>
                            <span className="font-medium">Gender:</span> {selectedPatient.gender}
                          </div>
                          <div>
                            <span className="font-medium">Birth Date:</span> {selectedPatient.birthDate}
                          </div>
                          <div>
                            <span className="font-medium">Contact:</span> {selectedPatient.contact || 'None'}
                          </div>
                          {selectedPatient.address && (
                            <div>
                              <span className="font-medium">Address:</span>{' '}
                              {formatJSON(selectedPatient.address)}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle>Medications</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {medications.length === 0 ? (
                          <div className="text-gray-500">No medications found for this patient</div>
                        ) : (
                          <div className="space-y-2">
                            {medications.map((med, index) => (
                              <div key={index} className="p-2 border rounded-md">
                                <div className="font-medium">
                                  {med.code?.text || 
                                   med.code?.coding?.[0]?.display || 
                                   'Unnamed Medication'}
                                </div>
                                {med.status && (
                                  <div className="text-sm">Status: {med.status}</div>
                                )}
                                {med.description && (
                                  <div className="text-sm">{med.description}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>FHIR Resource Search</CardTitle>
              <CardDescription>Search for any FHIR resource type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Resource Type</label>
                    <Select 
                      value={searchResourceType} 
                      onValueChange={setSearchResourceType}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a resource type" />
                      </SelectTrigger>
                      <SelectContent>
                        {resources.map(resource => (
                          <SelectItem key={resource} value={resource}>
                            {resource}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Parameters</label>
                    <Input
                      placeholder="_count=5&status=active"
                      value={searchParams}
                      onChange={(e) => setSearchParams(e.target.value)}
                    />
                  </div>
                </div>
                
                <Button 
                  onClick={handleGeneralSearch}
                  disabled={loading || !searchResourceType}
                  className="w-full"
                >
                  {loading ? 'Searching...' : 'Search Resources'}
                </Button>

                {error && (
                  <div className="p-2 bg-red-100 border border-red-400 text-red-700 rounded">
                    {error}
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="border rounded-md">
                    <div className="p-2 bg-gray-100 font-medium border-b">
                      Found {searchResults.length} {searchResourceType} Resources
                    </div>
                    <div className="p-2 max-h-96 overflow-auto">
                      <pre className="text-xs whitespace-pre-wrap">
                        {formatJSON(searchResults)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
