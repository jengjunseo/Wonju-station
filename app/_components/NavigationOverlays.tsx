"use client";

// Interaction model adapted from the 21st.dev COSS Drawer and HextaUI Command Menu.
// Sources: https://21st.dev/@coss.com/components/drawer (MIT)
//          https://21st.dev/@preetsuthar17/components/command-menu

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import * as Dialog from "@radix-ui/react-dialog";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  CloudSun,
  Heart,
  Landmark,
  MapPinned,
  Route,
  Search,
  Utensils,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

type NavigationItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

export type CommandPlace = {
  slug: string;
  name: string;
  region: string;
  line: string;
};

const primaryItems: NavigationItem[] = [
  {
    href: "/places",
    label: "어디 갈까",
    description: "풍경과 장소를 둘러보기",
    icon: Landmark,
  },
  {
    href: "/eat",
    label: "먹고 마시기",
    description: "시장과 한 끼를 찾아보기",
    icon: Utensils,
  },
  {
    href: "/courses",
    label: "하루 코스",
    description: "장소를 하루의 순서로 잇기",
    icon: Route,
  },
  {
    href: "/now",
    label: "지금 원주",
    description: "이번 달 일정과 공식 소식",
    icon: CalendarDays,
  },
  {
    href: "/plan",
    label: "여행 준비",
    description: "날씨와 이동 정보 확인",
    icon: CloudSun,
  },
];

const utilityItems: NavigationItem[] = [
  {
    href: "/map",
    label: "원주 지도",
    description: "좌표로 장소 고르기",
    icon: MapPinned,
  },
  {
    href: "/saved",
    label: "저장한 여행",
    description: "내가 고른 장소 보기",
    icon: Heart,
  },
  {
    href: "/about/wonju",
    label: "원주 읽기",
    description: "도시의 역사와 사람",
    icon: BookOpen,
  },
  {
    href: "/sources",
    label: "출처와 사용권",
    description: "정보와 사진의 근거",
    icon: Search,
  },
];

function current(href: string, pathname: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

export function MobileNavigationDrawer({
  open,
  onOpenChange,
  pathname,
  savedCount,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
  savedCount: number;
  onNavigate: (href: string) => void;
}) {
  function follow(href: string) {
    onOpenChange(false);
    onNavigate(href);
  }

  return (
    <DrawerPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      swipeDirection="right"
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Backdrop className="station-drawer-backdrop" />
        <DrawerPrimitive.Viewport className="station-drawer-viewport">
          <DrawerPrimitive.Popup className="station-drawer-popup">
            <div className="station-drawer-head">
              <div>
                <span>WONJU STATION</span>
                <DrawerPrimitive.Title>
                  오늘 어디로 갈까요?
                </DrawerPrimitive.Title>
              </div>
              <DrawerPrimitive.Close
                className="station-overlay-close"
                aria-label="메뉴 닫기"
              >
                <X aria-hidden="true" />
              </DrawerPrimitive.Close>
            </div>
            <DrawerPrimitive.Description className="station-drawer-description">
              장소를 고르거나, 하루의 순서부터 살펴보세요.
            </DrawerPrimitive.Description>
            <DrawerPrimitive.Content className="station-drawer-content">
              <nav className="station-drawer-nav" aria-label="전체 메뉴">
                {primaryItems.map((item, index) => {
                  const Icon = item.icon;
                  const active = current(item.href, pathname);
                  return (
                    <a
                      className={active ? "active" : ""}
                      href={item.href}
                      key={item.href}
                      onClick={(event) => {
                        event.preventDefault();
                        follow(item.href);
                      }}
                      aria-current={active ? "page" : undefined}
                    >
                      <span className="station-drawer-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <Icon aria-hidden="true" />
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                      <ChevronRight aria-hidden="true" />
                    </a>
                  );
                })}
              </nav>
              <div className="station-drawer-utilities">
                {utilityItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      href={item.href}
                      key={item.href}
                      onClick={(event) => {
                        event.preventDefault();
                        follow(item.href);
                      }}
                    >
                      <Icon aria-hidden="true" />
                      <span>
                        {item.label}
                        {item.href === "/saved" && savedCount
                          ? ` · ${savedCount}`
                          : ""}
                      </span>
                    </a>
                  );
                })}
              </div>
            </DrawerPrimitive.Content>
            <div className="station-drawer-foot">
              원주의 풍경·맛·문화를 하루의 동선으로 잇습니다.
            </div>
          </DrawerPrimitive.Popup>
        </DrawerPrimitive.Viewport>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}

export function CommandPalette({
  open,
  onOpenChange,
  query,
  onQueryChange,
  places,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (value: string) => void;
  places: CommandPlace[];
  onNavigate: (href: string) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const shortcuts = useMemo(() => primaryItems.slice(0, 3), []);
  const visibleCount = query.trim() ? places.length : shortcuts.length;

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (!open) setSelectedIndex(0);
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [onOpenChange, open]);

  function follow(href: string) {
    onOpenChange(false);
    onQueryChange("");
    onNavigate(href);
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!visibleCount) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((value) => (value + 1) % visibleCount);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((value) => (value - 1 + visibleCount) % visibleCount);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const target = query.trim()
        ? places[selectedIndex] && `/places/${places[selectedIndex].slug}`
        : shortcuts[selectedIndex]?.href;
      if (target) follow(target);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setSelectedIndex(0);
        onOpenChange(nextOpen);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="station-command-backdrop" />
        <Dialog.Content
          className="station-command"
          aria-describedby="station-command-description"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <div className="station-command-head">
            <Search aria-hidden="true" />
            <Dialog.Title>원주에서 찾기</Dialog.Title>
            <Dialog.Close
              className="station-overlay-close"
              aria-label="검색 닫기"
            >
              <X aria-hidden="true" />
            </Dialog.Close>
          </div>
          <Dialog.Description
            id="station-command-description"
            className="sr-only"
          >
            원주의 장소와 여행 메뉴를 검색합니다.
          </Dialog.Description>
          <div className="station-command-input-wrap">
            <Search aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setSelectedIndex(0);
                onQueryChange(event.target.value);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="장소, 코스, 이야기 검색"
              aria-label="원주 여행 검색"
            />
            <kbd>ESC</kbd>
          </div>
          <div
            className="station-command-results"
            role="listbox"
            aria-label="검색 결과"
          >
            <div className="station-command-label" aria-live="polite">
              {query.trim()
                ? places.length
                  ? `${places.length}곳을 찾았어요`
                  : "검색 결과 없음"
                : "바로 가기"}
            </div>
            {query.trim()
              ? places.map((place, index) => (
                  <button
                    type="button"
                    className={selectedIndex === index ? "active" : ""}
                    key={place.slug}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => follow(`/places/${place.slug}`)}
                    role="option"
                    aria-selected={selectedIndex === index}
                  >
                    <MapPinned aria-hidden="true" />
                    <span>
                      <strong>{place.name}</strong>
                      <small>
                        {place.region} · {place.line}
                      </small>
                    </span>
                    <ChevronRight aria-hidden="true" />
                  </button>
                ))
              : shortcuts.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <button
                      type="button"
                      className={selectedIndex === index ? "active" : ""}
                      key={item.href}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => follow(item.href)}
                      role="option"
                      aria-selected={selectedIndex === index}
                    >
                      <Icon aria-hidden="true" />
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                      <ChevronRight aria-hidden="true" />
                    </button>
                  );
                })}
            {query.trim() && !places.length ? (
              <div className="station-command-empty">
                다른 장소 이름이나 지역으로 검색해보세요. 음식점·카페 검색은
                먹고 마시기에서 확인할 수 있습니다.
              </div>
            ) : null}
          </div>
          <div className="station-command-foot">
            <span>↑↓ 이동</span>
            <span>Enter 열기</span>
            <span>Ctrl K 검색</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
