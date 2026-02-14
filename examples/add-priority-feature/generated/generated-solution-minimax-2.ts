/**
 * Simple TODO application (base code for swarm task)
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
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return [...todos].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);


}