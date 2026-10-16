async function main() {
  const subInvalid = {
    classes: [
      {
        id: 'c1',
        name: 'ParkingFloor',
        kind: 'class',
        attributes: [],
        methods: [{ id: 'm1', name: 'findAvailableSpot', returnType: '', visibility: '+', parameters: [] }],
      },
    ],
    relationships: [],
    rationale: '',
  };

  console.log('--- Testing live POST /api/attempts with invalid returnType ---');
  const res1 = await fetch('http://localhost:4000/api/attempts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-learner-id': 'live-test-user' },
    body: JSON.stringify({ problemId: 'parking-lot', submission: subInvalid }),
  });
  console.log('Status:', res1.status);
  const data1 = await res1.json();
  console.log('Response:', JSON.stringify(data1, null, 2));

  console.log('\n--- Testing live POST /api/attempts with corrected submission ---');
  const subValid = {
    classes: [
      {
        id: 'cls-lot',
        name: 'ParkingLot',
        kind: 'class',
        attributes: [{ id: 'a1', name: 'floors', type: 'List<ParkingFloor>', visibility: '-' }],
        methods: [
          {
            id: 'm1',
            name: 'issueTicket',
            returnType: 'ParkingTicket',
            visibility: '+',
            parameters: [{ name: 'v', type: 'Vehicle' }],
          },
        ],
        layout: { x: 80, y: 60, width: 240, height: 140, rotation: 0 },
      },
      {
        id: 'cls-floor',
        name: 'ParkingFloor',
        kind: 'class',
        attributes: [{ id: 'a2', name: 'floorNumber', type: 'int', visibility: '-' }],
        methods: [
          {
            id: 'm2',
            name: 'findAvailableSpot',
            returnType: 'ParkingSpot',
            visibility: '+',
            parameters: [{ name: 'v', type: 'Vehicle' }],
          },
          {
            id: 'm3',
            name: 'addSpot',
            returnType: 'void',
            visibility: '+',
            parameters: [{ name: 'spot', type: 'ParkingSpot' }],
          },
        ],
        layout: { x: 420, y: 60, width: 240, height: 140, rotation: 0 },
      },
      {
        id: 'cls-spot',
        name: 'ParkingSpot',
        kind: 'class',
        attributes: [{ id: 'a3', name: 'isOccupied', type: 'boolean', visibility: '-' }],
        methods: [
          {
            id: 'm4',
            name: 'assignVehicle',
            returnType: 'boolean',
            visibility: '+',
            parameters: [{ name: 'v', type: 'Vehicle' }],
          },
        ],
        layout: { x: 420, y: 260, width: 240, height: 140, rotation: 0 },
      },
    ],
    relationships: [
      {
        id: 'r1',
        sourceId: 'cls-lot',
        targetId: 'cls-floor',
        type: 'composition',
        label: 'manages',
        sourceMultiplicity: '1',
        targetMultiplicity: '1..*',
      },
      {
        id: 'r2',
        sourceId: 'cls-floor',
        targetId: 'cls-spot',
        type: 'composition',
        label: 'contains',
        sourceMultiplicity: '1',
        targetMultiplicity: '1..*',
      },
    ],
    rationale: 'Clean test hierarchy with proper semantic types.',
  };

  const res2 = await fetch('http://localhost:4000/api/attempts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-learner-id': 'live-test-user' },
    body: JSON.stringify({ problemId: 'parking-lot', submission: subValid }),
  });
  console.log('Status:', res2.status);
  const data2 = await res2.json();
  console.log('Created Attempt ID:', data2.data?.id);
  console.log('Attempt Status:', data2.data?.status);
  console.log('Total Score:', data2.data?.report?.totalScore);
  console.log('Evaluator Strategy:', data2.data?.report?.evaluatorMetadata?.strategyUsed);
  console.log('AI Model:', data2.data?.report?.evaluatorMetadata?.aiModel);
  console.log('Strengths:', data2.data?.report?.strengths?.length);
  console.log('Findings:', data2.data?.report?.findings?.length);
}

main().catch(console.error);
