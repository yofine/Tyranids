/**
 * Solution 2: Using numeric priority (1-5)
 *
 * Approach: Priority as number with validation
 * Pros: Flexible, easy to sort
 * Cons: Less readable without context
 */

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  priority: number; // 1 (lowest) - 5 (highest)
}

const todos: Todo[] = [];

export function addTodo(title: string, priority: number = 3): Todo {
  if (priority < 1 || priority > 5) {
    throw new Error('Priority must be between 1 and 5');
  }

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
  return [...todos].sort((a, b) => b.priority - a.priority);
}

export function setPriority(id: string, priority: number): void {
  if (priority < 1 || priority > 5) {
    throw new Error('Priority must be between 1 and 5');
  }

  const todo = todos.find((t) => t.id === id);
  if (todo) {
    todo.priority = priority;
  }
}
