import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';

describe('App navigation & views', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders Segmentor workspace and switches across Profile, Rings, Cut Sheet, and Shop Mode', () => {
    render(<App />);
    expect(screen.getByText('Segmentor')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Would? By Marty' })).toHaveAttribute(
      'href',
      'https://wouldbymarty.com/',
    );
    expect(screen.getByText('Vessel Profile')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Rings$/i }));
    expect(screen.getByText('Ring Cross-Section')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Cut Sheet$/i }));
    expect(screen.getByRole('heading', { name: 'Cut Sheet' })).toBeInTheDocument();
    expect(screen.getByText(/Board-Foot Summary/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Shop$/i }));
    expect(screen.getByText('Shop Mode Checklist')).toBeInTheDocument();
    expect(screen.getByText(/1:1 Printable Profile Story Stick/i)).toBeInTheDocument();
  });

  it('loads the Tapered Stave Vessel preset and updates tabs/cut-sheet to Stave mode', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Tapered Stave Vessel'));

    expect(screen.getByRole('button', { name: /^Staves$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Cut Sheet$/i }));
    expect(screen.getByText('Blade Bevel')).toBeInTheDocument();
    expect(screen.getByText('Miter Gauge')).toBeInTheDocument();
  });
});
