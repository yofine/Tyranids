/**
 * Solution 1: Using string literal union type for priority
 *
 * Approach: Priority as 'low' | 'medium' | 'high'
 * Pros: Type-safe, readable
 * Cons: Less flexible for custom priorities
 */

export type Priority = 'low' | 'medium' | 'high';

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  priority: Priority;
}

const todos: Todo[] = [];

export function addTodo(title: string, priority: Priority = 'medium'): Todo {
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
  const priorityOrder: Record<Priority, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  return [...todos].sort((a, b) => {
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}
