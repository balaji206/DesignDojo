import { Problem } from '../domain/types.js';

export const SEED_PROBLEMS: Problem[] = [
  {
    id: 'prob-parking-lot',
    slug: 'parking-lot',
    title: 'Multi-Floor Parking Lot System',
    difficulty: 'Medium',
    topics: ['OOP', 'SOLID', 'Strategy Pattern', 'Factory Pattern', 'Relationships'],
    description:
      'Design an object-oriented multi-floor Parking Lot system that manages vehicle entry, spot allocation across multiple vehicle and spot sizes, ticket issuance, and modular fee calculation upon exit.',
    functionalRequirements: [
      'Support multiple floors, each containing typed parking spots (Compact, Large, Handicapped, Motorcycle, EV).',
      'Support different vehicle types (Motorcycle, Car, Van, Truck) with clear compatibility rules.',
      'Issue a timestamped ParkingTicket at entry gates and release the spot upon payment at exit gates.',
      'Calculate parking fees using extensible pricing strategies (e.g., hourly rate, flat rate, or weekend surge).',
      'Track real-time spot availability per floor and vehicle type.',
    ],
    constraints: [
      'Spot allocation must prevent double-booking when multiple entry gates operate concurrently.',
      'Adding a new pricing strategy or payment method must not require modifying the core ParkingLot or ExitGate classes (Open/Closed Principle).',
    ],
    acceptanceCriteria: [
      'Includes core domain classes for ParkingLot, ParkingFloor, ParkingSpot, Vehicle, and ParkingTicket.',
      'Uses an interface or abstract class for pricing strategy or spot assignment strategy.',
      'Clearly expresses composition between ParkingLot -> ParkingFloor -> ParkingSpot.',
    ],
    hints: [
      'Separate physical infrastructure (ParkingLot, ParkingFloor, ParkingSpot) from transactional entities (ParkingTicket, Payment).',
      'Consider a PricingStrategy or SpotAllocationStrategy interface so new algorithms can be plugged in cleanly.',
    ],
    rubric: {
      expectedConcepts: [
        {
          nameVariants: ['ParkingLot', 'LotManager'],
          description: 'Central coordinator managing floors, entry/exit panels, and tickets',
          requiredMethods: ['park', 'unpark', 'getAvailableSpots', 'issueTicket'],
        },
        {
          nameVariants: ['ParkingFloor', 'Floor', 'Level'],
          description: 'Floor container managing a collection of parking spots',
          requiredMethods: ['findAvailableSpot', 'addSpot'],
        },
        {
          nameVariants: ['ParkingSpot', 'Spot', 'Slot'],
          description: 'Individual parking space with occupancy and size type',
          requiredMethods: ['assignVehicle', 'removeVehicle', 'isFree', 'canFit'],
        },
        {
          nameVariants: ['Vehicle', 'Car', 'Motorcycle', 'Truck'],
          description: 'Vehicle hierarchy or entity with license plate and size category',
        },
        {
          nameVariants: ['ParkingTicket', 'Ticket'],
          description: 'Ticket linking a parked vehicle, assigned spot, and entry timestamp',
        },
        {
          nameVariants: ['PricingStrategy', 'FeeStrategy', 'PaymentStrategy', 'RateCalculator'],
          description: 'Extensible strategy interface for fee calculation or payment processing',
          requiredMethods: ['calculateFee', 'calculate', 'pay'],
        },
      ],
      requireInterfacesOrAbstract: true,
      minimumRelationships: 4,
    },
  },
  {
    id: 'prob-elevator-system',
    slug: 'elevator-system',
    title: 'Smart Building Elevator Control System',
    difficulty: 'Hard',
    topics: ['OOP', 'State Pattern', 'Strategy Pattern', 'Relationships', 'Extensibility'],
    description:
      'Design the software architecture for a multi-elevator control system in a high-rise building. The system must process hall calls (Up/Down buttons on floors) and cabin calls (destination floor buttons inside each elevator) using pluggable scheduling algorithms.',
    functionalRequirements: [
      'Coordinate multiple ElevatorCars operating across N building floors.',
      'Distribute floor hall requests to the optimal elevator using a replaceable dispatching strategy (e.g., LOOK/SCAN, shortest seek time, or zone-based).',
      'Track each elevator car state (MovingUp, MovingDown, Idle, Maintenance) and door state (Open, Closed).',
      'Enforce weight/capacity limits and emergency stop overrides.',
    ],
    constraints: [
      'Switching the elevator scheduling algorithm must not require altering ElevatorCar internals.',
      'Hall requests and cabin requests carry different data and should be modeled cleanly.',
    ],
    acceptanceCriteria: [
      'Models ElevatorController, ElevatorCar, Request/Button, Door, and Dispatcher/Scheduler.',
      'Includes an interface for the scheduling/dispatch strategy.',
      'Connects ElevatorController to ElevatorCars and Dispatcher with clear relationships.',
    ],
    hints: [
      'Use a SchedulerStrategy / DispatchStrategy interface injected into the ElevatorController.',
      'Keep physical components (Door, CabinPanel, FloorButton) decoupled from the routing algorithm.',
    ],
    rubric: {
      expectedConcepts: [
        {
          nameVariants: ['ElevatorController', 'ElevatorSystem', 'BuildingController'],
          description: 'System coordinator receiving hall requests and delegating to cars',
          requiredMethods: ['requestElevator', 'dispatch', 'step'],
        },
        {
          nameVariants: ['ElevatorCar', 'Elevator', 'Cabin'],
          description: 'Individual elevator car tracking current floor, direction, and destination queue',
          requiredMethods: ['move', 'addStop', 'openDoor', 'closeDoor'],
        },
        {
          nameVariants: ['DispatchStrategy', 'Scheduler', 'SchedulingStrategy', 'ElevatorScheduler'],
          description: 'Pluggable strategy selecting the best elevator car for a request',
          requiredMethods: ['selectElevator', 'schedule'],
        },
        {
          nameVariants: ['Request', 'HallRequest', 'CabinRequest', 'FloorRequest'],
          description: 'Request payload representing floor origin/destination and direction',
        },
      ],
      requireInterfacesOrAbstract: true,
      minimumRelationships: 3,
    },
  },
  {
    id: 'prob-vending-machine',
    slug: 'vending-machine',
    title: 'Automated Vending Machine with State Management',
    difficulty: 'Easy',
    topics: ['OOP', 'State Pattern', 'SOLID', 'Encapsulation'],
    description:
      'Design the Low-Level Design for a physical Vending Machine that manages product inventory shelves, accepts multiple denominations or payment modes, dispenses items, returns change, and enforces valid operational state transitions.',
    functionalRequirements: [
      'Manage product slots/racks with item codes, prices, and stock quantities.',
      'Handle user interactions across distinct operational states: Idle, HasMoney/AcceptingPayment, Dispensing, and OutOfStock.',
      'Validate sufficient balance and item stock before dispensing.',
      'Calculate and return accurate change or refund inserted money upon cancellation.',
    ],
    constraints: [
      'Prevent invalid actions in inappropriate states (e.g., dispensing before payment is verified, or accepting selection without stock).',
      'Avoid sprawling if/else state checks inside the main VendingMachine class.',
    ],
    acceptanceCriteria: [
      'Models VendingMachine, VendingState (interface/abstract), Inventory/Slot, and Product.',
      'Uses the State pattern or clean behavioral abstraction to manage transitions.',
      'Defines clear relationships between VendingMachine, Inventory, and State.',
    ],
    hints: [
      'Define a VendingMachineState interface with methods like selectProduct(), insertPayment(), dispense(), and refund().',
      'Separate Inventory/Rack management from payment calculation.',
    ],
    rubric: {
      expectedConcepts: [
        {
          nameVariants: ['VendingMachine', 'Machine'],
          description: 'Context class holding current state, active balance, and inventory reference',
          requiredMethods: ['selectItem', 'insertMoney', 'dispense', 'setState'],
        },
        {
          nameVariants: ['VendingState', 'State', 'MachineState', 'IdleState', 'DispensingState'],
          description: 'State interface or hierarchy governing allowed operations per step',
          requiredMethods: ['insertMoney', 'selectProduct', 'dispense', 'cancel'],
        },
        {
          nameVariants: ['Inventory', 'Rack', 'ItemSlot', 'Shelf'],
          description: 'Inventory tracking product slots and available quantities',
          requiredMethods: ['getQuantity', 'deduct', 'addProduct', 'isAvailable'],
        },
        {
          nameVariants: ['Product', 'Item'],
          description: 'Item metadata including name, SKU/code, and unit price',
        },
      ],
      requireInterfacesOrAbstract: true,
      minimumRelationships: 3,
    },
  },
];
