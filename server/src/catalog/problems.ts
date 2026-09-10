import type { LldProblem } from "../domain/problem.ts";

export const PROBLEM_CATALOG: LldProblem[] = [
  {
    id: "prob-parking",
    slug: "parking-lot",
    title: "Parking lot",
    difficulty: "intro",
    estimatedMinutes: 35,
    blurb: "Spots, tickets, fees. The classic first LLD — easy to start, easy to dump into one Manager class.",
    prompt: `A small city garage has floors of spots in three sizes: compact, regular, and large.
Cars, bikes, and vans arrive. A van needs a large spot. A bike may take any size. A car takes regular or large.

On entry the system issues a ticket. On exit it computes a fee from time parked and vehicle type, then frees the spot.

The attendant can ask "how many spots of each size are free on floor 2?"

Design the types, who owns the inventory, who owns pricing, and how a ticket finds its spot again.`,
    constraints: [
      "In-memory is fine; do not design a database schema.",
      "Single garage, not a chain of garages.",
      "No payments, invoices, or accounts.",
      "Assume clocks are trustworthy.",
    ],
    functionalReqs: [
      "Park a vehicle if a legal spot exists, otherwise refuse.",
      "Issue a ticket that can later retrieve the parking session.",
      "Unpark using the ticket and return the fee.",
      "Query free-spot counts by floor and size.",
    ],
    changeScenarios: [
      "Add a fourth vehicle type (electric) that may only use EV-marked spots.",
      "Swap hourly pricing for a day-pass that caps the fee.",
    ],
    designSignals: [
      {
        token: "Spot",
        aliases: ["ParkingSpot", "stall"],
        why: "Inventory belongs on a spot (or a small collection of spots), not on a god ParkingLotManager.",
        criterionHint: "class_responsibilities",
      },
      {
        token: "Ticket",
        aliases: ["ParkingTicket", "receipt"],
        why: "The session needs an id that outlives the vehicle object sitting in a spot.",
        criterionHint: "class_responsibilities",
      },
      {
        token: "Fee",
        aliases: ["Pricing", "Fare", "Rate"],
        why: "Pricing changes independently of how spots are allocated.",
        criterionHint: "extensibility",
      },
      {
        token: "Vehicle",
        aliases: ["Car", "Bike", "Van"],
        why: "Size rules should sit with the vehicle (or a policy), not a switch in the lot.",
        criterionHint: "abstraction",
      },
      {
        token: "Floor",
        aliases: ["Level"],
        why: "Free-count by floor is awkward if every spot lives in one flat list.",
        criterionHint: "coupling_cohesion",
      },
    ],
  },
  {
    id: "prob-elevator",
    slug: "elevator",
    title: "Elevator control",
    difficulty: "core",
    estimatedMinutes: 45,
    blurb: "Requests, direction, and which car should move. Concurrency-lite, state-machine-heavy.",
    prompt: `An office building has one bank of N elevators and F floors.
People press hall buttons (up/down) and cabin buttons (destination floor).

The controller should:
- not send every car to the same hall call
- keep travelling in one direction while that still makes sense (SCAN-ish)
- open doors, load, move, stop

You do not need threads. Model the interesting states and who decides the next stop.`,
    constraints: [
      "No safety hardware, weight sensors, or fire mode.",
      "Ignore people walking between cars in the shaft.",
      "A simple tick()/step() API is enough instead of real time.",
    ],
    functionalReqs: [
      "Accept a hall call with direction.",
      "Accept a cabin destination once a rider is inside.",
      "Assign a hall call to a car.",
      "Advance the system one step at a time (move / open / close).",
    ],
    changeScenarios: [
      "Add express cars that skip floors 2–10.",
      "Prefer the nearest idle car instead of SCAN when the building is quiet.",
    ],
    designSignals: [
      {
        token: "HallCall",
        aliases: ["Request", "FloorRequest"],
        why: "A pending call is data. Mixing it into the car's current floor invites bugs.",
        criterionHint: "class_responsibilities",
      },
      {
        token: "Direction",
        aliases: ["UP", "DOWN", "IDLE"],
        why: "Direction is a first-class state, not a boolean.",
        criterionHint: "encapsulation",
      },
      {
        token: "Dispatcher",
        aliases: ["Scheduler", "Assigner", "Controller"],
        why: "Assignment policy should be replaceable (change test: nearest idle vs SCAN).",
        criterionHint: "extensibility",
      },
      {
        token: "Door",
        aliases: ["DoorState"],
        why: "Door open/close is easy to bury inside move() and then impossible to test.",
        criterionHint: "edge_cases",
      },
      {
        token: "ElevatorCar",
        aliases: ["Cabin", "Car"],
        why: "Each car should own its queue and floor, not a global array of integers.",
        criterionHint: "coupling_cohesion",
      },
    ],
  },
  {
    id: "prob-splitwise",
    slug: "expense-split",
    title: "Expense split",
    difficulty: "core",
    estimatedMinutes: 40,
    blurb: "Balances, not just a list of IOUs. The interesting bit is how you simplify debt.",
    prompt: `A group of friends log expenses. An expense has a payer, a list of participants, and a split rule (equal, exact amounts, or percent).

Anyone can ask:
- what does A owe B?
- what is the minimum set of transfers that settles the group?

People can be added to the group later. Do not build chat, comments, or currency conversion.`,
    constraints: [
      "One currency.",
      "No partial settlements beyond recording a 'settlement' expense if you want that model.",
      "Integer cents are nicer than floats — mention how you avoid rounding fights.",
    ],
    functionalReqs: [
      "Add a person to a group.",
      "Record an expense with a split rule.",
      "Query net balance of a person.",
      "Produce a simplified settlement (who pays whom).",
    ],
    changeScenarios: [
      "Support a 'shares' split (Alice 2 shares, Bob 1 share).",
      "Allow someone to settle a subset of their debt to one person.",
    ],
    designSignals: [
      {
        token: "Split",
        aliases: ["SplitRule", "EqualSplit", "PercentSplit"],
        why: "Split policy is the piece that will grow. A switch in addExpense() will rot.",
        criterionHint: "abstraction",
      },
      {
        token: "Balance",
        aliases: ["Ledger", "Net"],
        why: "Keep a net ledger; do not rescan every expense to answer 'what does A owe'.",
        criterionHint: "class_responsibilities",
      },
      {
        token: "Settlement",
        aliases: ["Transfer", "Simplify"],
        why: "Simplifying debt is a separate algorithm from recording an expense.",
        criterionHint: "coupling_cohesion",
      },
      {
        token: "Money",
        aliases: ["cent", "MinorUnit", "Amount"],
        why: "Floating rupees/dollars will fail the rounding conversation.",
        criterionHint: "edge_cases",
      },
      {
        token: "Group",
        aliases: ["ExpenseGroup"],
        why: "Membership and expenses need a boundary so a person can be in two groups.",
        criterionHint: "encapsulation",
      },
    ],
  },
  {
    id: "prob-library",
    slug: "library",
    title: "Library loans",
    difficulty: "intro",
    estimatedMinutes: 30,
    blurb: "Copies vs titles, holds, and overdue rules. A good place to practice identity.",
    prompt: `A neighbourhood library lends books. A catalogue title can have several physical copies.
Members borrow a copy, return it, and may place a hold on a title when every copy is out.

Rules of thumb:
- a member has a borrow limit
- overdue copies block new loans (or at least get mentioned)
- a returned copy goes to the first hold in line if one exists

Design identity carefully: ISBN is not a copy id.`,
    constraints: [
      "No money, fines calculation can be a stub.",
      "No multi-branch transfers.",
      "Search can be exact title/author; skip elasticsearch.",
    ],
    functionalReqs: [
      "Register a member.",
      "Add a title and copies.",
      "Checkout a copy to a member.",
      "Return a copy, respecting holds.",
      "Place a hold on a title.",
    ],
    changeScenarios: [
      "Add magazines that cannot be placed on hold.",
      "Allow a staff override that ignores the borrow limit.",
    ],
    designSignals: [
      {
        token: "Copy",
        aliases: ["BookCopy", "Item"],
        why: "The thing that moves is a copy. Titles do not get loaned.",
        criterionHint: "class_responsibilities",
      },
      {
        token: "Hold",
        aliases: ["Reservation", "Waitlist"],
        why: "Holds are a queue on the title, not a flag on a random copy.",
        criterionHint: "coupling_cohesion",
      },
      {
        token: "Loan",
        aliases: ["Checkout", "Borrowing"],
        why: "A loan is a period with a start (and maybe due date), not a boolean on Member.",
        criterionHint: "encapsulation",
      },
      {
        token: "Member",
        aliases: ["Patron"],
        why: "Borrow limits belong with the member policy, not inside Copy.",
        criterionHint: "extensibility",
      },
      {
        token: "Title",
        aliases: ["Catalogue", "ISBN"],
        why: "Catalogue data and physical inventory change for different reasons.",
        criterionHint: "requirement_understanding",
      },
    ],
  },
];

