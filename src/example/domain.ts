export interface User {
  id: number;
  name: string;
  email: string;
  status: "active" | "pending";
}

export type SortColumn = "name" | "email";
export type SortDirection = "asc" | "desc";

export interface UsersPage {
  rows: User[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sortCol: SortColumn;
  sortDir: SortDirection;
}

export interface UserSuggestion {
  id: number;
  name: string;
  email: string;
  status: "active" | "pending";
}

export interface CreateUserInput {
  name: string;
  email: string;
}

const seedUsers: User[] = [
  { id: 1, name: "Ava Kim", email: "ava.kim@example.com", status: "active" },
  {
    id: 2,
    name: "Noah Patel",
    email: "noah.patel@example.com",
    status: "pending",
  },
  {
    id: 3,
    name: "Maya Chen",
    email: "maya.chen@example.com",
    status: "active",
  },
  {
    id: 4,
    name: "Ethan Ruiz",
    email: "ethan.ruiz@example.com",
    status: "active",
  },
  {
    id: 5,
    name: "Liam Park",
    email: "liam.park@example.com",
    status: "pending",
  },
  {
    id: 6,
    name: "Sofia Bell",
    email: "sofia.bell@example.com",
    status: "active",
  },
  {
    id: 7,
    name: "Owen Brooks",
    email: "owen.brooks@example.com",
    status: "active",
  },
  {
    id: 8,
    name: "Ivy Torres",
    email: "ivy.torres@example.com",
    status: "pending",
  },
  {
    id: 9,
    name: "Leo Foster",
    email: "leo.foster@example.com",
    status: "active",
  },
  {
    id: 10,
    name: "Nora Diaz",
    email: "nora.diaz@example.com",
    status: "pending",
  },
  {
    id: 11,
    name: "Caleb Shah",
    email: "caleb.shah@example.com",
    status: "active",
  },
  {
    id: 12,
    name: "Aria Wells",
    email: "aria.wells@example.com",
    status: "active",
  },
  {
    id: 13,
    name: "Elena Fox",
    email: "elena.fox@example.com",
    status: "pending",
  },
  {
    id: 14,
    name: "Milo Stone",
    email: "milo.stone@example.com",
    status: "active",
  },
  {
    id: 15,
    name: "Zoe Grant",
    email: "zoe.grant@example.com",
    status: "active",
  },
  {
    id: 16,
    name: "Ruby Lane",
    email: "ruby.lane@example.com",
    status: "pending",
  },
];

const usersStore: User[] = [...seedUsers];
let nextId = usersStore.length + 1;

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

export function listUsersPage(
  page: number,
  pageSize: number,
  sortCol: SortColumn,
  sortDir: SortDirection,
): UsersPage {
  const sorted = [...usersStore].sort((left, right) => {
    const direction = sortDir === "asc" ? 1 : -1;
    return compareStrings(left[sortCol], right[sortCol]) * direction;
  });

  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(safePage, totalPages);

  const start = (clampedPage - 1) * pageSize;
  const rows = sorted.slice(start, start + pageSize);

  return {
    rows,
    page: clampedPage,
    pageSize,
    total,
    totalPages,
    sortCol,
    sortDir,
  };
}

function scoreSuggestionMatch(user: User, query: string): number {
  const name = user.name.toLowerCase();
  const email = user.email.toLowerCase();

  if (name.startsWith(query)) {
    return 4;
  }

  if (email.startsWith(query)) {
    return 3;
  }

  if (name.includes(query)) {
    return 2;
  }

  if (email.includes(query)) {
    return 1;
  }

  return 0;
}

export function suggestUsers(query: string, limit = 8): UserSuggestion[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 8;

  return usersStore
    .map((user) => ({
      user,
      score: scoreSuggestionMatch(user, normalized),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      return compareStrings(left.user.name, right.user.name);
    })
    .slice(0, safeLimit)
    .map(({ user }) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
    }));
}

export function getUserById(id: number): User | undefined {
  return usersStore.find((u) => u.id === id);
}

export function createUser(input: CreateUserInput): User {
  const user: User = {
    id: nextId,
    name: input.name,
    email: input.email,
    status: "pending",
  };
  nextId += 1;
  usersStore.push(user);
  return user;
}

export function deleteUser(id: number): boolean {
  const index = usersStore.findIndex((u) => u.id === id);
  if (index !== -1) {
    usersStore.splice(index, 1);
    return true;
  }
  return false;
}

export function activateUser(id: number): User | undefined {
  const user = usersStore.find((u) => u.id === id);
  if (user) {
    user.status = "active";
  }
  return user;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  status?: "active" | "pending";
}

export function updateUser(
  id: number,
  input: UpdateUserInput,
): User | undefined {
  const user = usersStore.find((u) => u.id === id);
  if (user) {
    if (input.name) user.name = input.name;
    if (input.email) user.email = input.email;
    if (input.status) user.status = input.status;
  }
  return user;
}

export interface UserStats {
  total: number;
  active: number;
  pending: number;
}

export function getUserStats(): UserStats {
  return {
    total: usersStore.length,
    active: usersStore.filter((u) => u.status === "active").length,
    pending: usersStore.filter((u) => u.status === "pending").length,
  };
}
