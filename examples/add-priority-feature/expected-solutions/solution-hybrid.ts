/**
 * Solution 3: Hybrid approach with enum and optional priority
 *
 * Approach: Enum for type safety + helper functions
 * Pros: Best of both worlds, backward compatible
 * Cons: More complex
 */

export enum Priority {
  Low = 1,
  Medium = 2,
  High = 3,
  Urgent = 4,
  Critical = 5,
}

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  priority?: Priority; // Optional for backward compatibility
}

const todos: Todo[] = [];

export function addTodo(title: string, priority: Priority = Priority.Medium): Todo {
  const todo: Todo = {
    id: Math.random().toString(36).slice(2),
    title,
    completed: false,
    priority,
  };
  todos.push(todo);
  return todo;
}

export function toggleTodo(id: string): void {
  const todo = todos.find((t) => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
  }
}

export function getTodos(): Todo[] {
  return [...todos];
}

export function sortByPriority(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    const aPriority = a.priority ?? Priority.Medium;
    const bPriority = b.priority ?? Priority.Medium;
    return bPriority - aPriority;
  });
}

export function setPriority(id: string, priority: Priority): void {
  const todo = todos.find((t) => t.id === id);
  if (todo) {
    todo.priority = priority;
  }
}

export function getPriorityLabel(priority: Priority): string {
  const labels: Record<Priority, string> = {
    [Priority.Low]: 'Low',
    [Priority.Medium]: 'Medium',
    [Priority.High]: 'High',
    [Priority.Urgent]: 'Urgent',
    [Priority.Critical]: 'Critical',
  };
  return labels[priority];
}
