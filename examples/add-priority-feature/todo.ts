/**
 * Simple TODO application (base code for swarm task)
 */

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

const todos: Todo[] = [];

export function addTodo(title: string): Todo {
  const todo: Todo = {
    id: Math.random().toString(36).slice(2),
    title,
    completed: false,
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
