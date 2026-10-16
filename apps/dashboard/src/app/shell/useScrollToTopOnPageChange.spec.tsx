/**
 * W1-65's fire/no-fire rule: moving to another page by link opens it at the top; a query-string
 * write on the same page (sort, filter, kind chip — all `setSearchParams(…, { replace: true })`)
 * never scrolls, nor does Back/Forward or an address with a #fragment.
 */
import { act, render } from '@testing-library/react';
import {
  MemoryRouter,
  useNavigate,
  useSearchParams,
  type NavigateFunction,
} from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useScrollToTopOnPageChange } from './useScrollToTopOnPageChange';

let navigate: NavigateFunction;
let setSearchParams: ReturnType<typeof useSearchParams>[1];
function Probe() {
  useScrollToTopOnPageChange();
  navigate = useNavigate();
  [, setSearchParams] = useSearchParams();
  return null;
}

function mount(initial = '/') {
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  render(
    <MemoryRouter initialEntries={[initial]}>
      <Probe />
    </MemoryRouter>,
  );
  return scrollTo;
}

afterEach(() => vi.restoreAllMocks());

describe('useScrollToTopOnPageChange (W1-65)', () => {
  it('does not scroll on the first load (a POP)', () => {
    expect(mount()).not.toHaveBeenCalled();
  });

  it('scrolls to the top when a link moves to another page', () => {
    const scrollTo = mount();
    act(() => navigate('/methodology'));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('does not scroll when the page replaces only its query string, after a link or after Back', () => {
    const scrollTo = mount();
    act(() => navigate('/scanner'));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    act(() => setSearchParams({ sort: 'score' }, { replace: true }));
    act(() => setSearchParams({ sort: 'tier' }, { replace: true }));
    expect(scrollTo).toHaveBeenCalledTimes(1);

    act(() => navigate('/research/filings'));
    act(() => navigate(-1));
    expect(scrollTo).toHaveBeenCalledTimes(2);
    act(() => setSearchParams({ kind: '10-K' }, { replace: true }));
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it('leaves an address with a #fragment to the page that scrolls to it', () => {
    const scrollTo = mount();
    act(() => navigate('/methodology#scoring'));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('scrolls when a redirect replaces the address with another page', () => {
    const scrollTo = mount();
    act(() => navigate('/ticker/SPY', { replace: true }));
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});
