import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders Segmentor header and geometry smoke stats', () => {
    render(<App />);
    expect(screen.getByText('Segmentor')).toBeInTheDocument();
    expect(screen.getByText(/Geometry Kernel Ready/i)).toBeInTheDocument();
    expect(screen.getByText('11.25°')).toBeInTheDocument();
  });
});
