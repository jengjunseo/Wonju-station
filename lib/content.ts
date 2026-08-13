export const VERIFIED_EVENTS = [
  { date: "2026-08-15", time: "15:00 / 19:00", title: "박경리 탄생 100주년 무용극 〈토지〉", place: "치악예술관", source: "https://www.wonju.go.kr/tojipark/main.do" },
  { date: "2026-07-06 — 10-05", time: "09:00 — 18:00", title: "원주시역사박물관 기획전시", place: "원주시역사박물관", source: "https://whm.wonju.go.kr/whm/main.php" },
] as const;

export const HISTORY_TIMELINE = [
  { year: "678", title: "북원소경", text: "통일신라의 9주 5소경 정비 때 북원소경이 설치되었습니다." },
  { year: "940", title: "‘원주’라는 이름", text: "고려 태조 23년에 북원경을 폐지하고 원주로 개칭했습니다." },
  { year: "1395", title: "강원감영 설치", text: "조선이 강원도의 수부를 원주로 정하고 강원감영을 설치했습니다." },
  { year: "1955", title: "원주시 승격", text: "원주읍이 원주시로 승격되어 현대 도시 행정의 장을 열었습니다." },
  { year: "1995", title: "도농 통합", text: "원주시와 원주군이 통합되어 오늘의 행정권역이 형성되었습니다." },
  { year: "2019", title: "유네스코 문학 창의도시", text: "문학을 도시의 지속 가능한 자산으로 연결하는 국제 네트워크에 합류했습니다." },
] as const;

export const HISTORICAL_PEOPLE = [
  { name: "임윤지당", label: "여성 성리학자", text: "원주를 대표하는 여성 성리학자. 선양관이 학문적 성과와 정신을 잇고 있습니다.", source: "https://whm.wonju.go.kr/whm/page/view.php/sub_09_02" },
  { name: "최규하", label: "대한민국 제10대 대통령", text: "원주 출신으로, 역사박물관 현석실이 유족 기증 유품을 전시합니다.", source: "https://whm.wonju.go.kr/whm/page/view.php/sub_02_01_04" },
  { name: "박경리", label: "소설가", text: "1980년부터 2008년까지 원주에서 살며 『토지』 4·5부와 생명사상을 완성했습니다.", source: "https://www.wonju.go.kr/cityofliterature/user_sub.php?gid=www&mu_idx=253" },
] as const;

export type WonjuTmi = {
  id: string;
  topic: "history" | "literature" | "place" | "people" | "culture";
  text: string;
  sourceLabel: string;
  sourceUrl: string;
  relatedRoute?: string;
};

/** Durable, non-live facts from Wonju City and its public cultural institutions. */
export const WONJU_TMI: readonly WonjuTmi[] = [
  { id: "name-940", topic: "history", text: "‘원주’라는 이름은 고려 태조 23년인 940년에 북원경을 원주로 고치면서 등장했어요.", sourceLabel: "원주시 공식 연혁", sourceUrl: "https://www.wonju.go.kr/www/contents.do?key=231", relatedRoute: "/history" },
  { id: "gangwon-name", topic: "history", text: "강원도라는 이름은 1395년 당시 큰 고을이던 강릉의 ‘강’과 원주의 ‘원’을 합쳐 만들었어요.", sourceLabel: "원주시 공식 연혁", sourceUrl: "https://www.wonju.go.kr/www/contents.do?key=231", relatedRoute: "/history" },
  { id: "integrated-1995", topic: "history", text: "지금의 도농 통합 원주시는 1995년 원주시와 원주군이 다시 합쳐지며 출범했어요.", sourceLabel: "원주시 공식 연혁", sourceUrl: "https://www.wonju.go.kr/www/contents.do?key=231", relatedRoute: "/history" },
  { id: "bukwon-678", topic: "history", text: "통일신라는 678년 원주에 북원소경을 두었어요. 수도 밖의 중요한 거점 도시였다는 흔적이에요.", sourceLabel: "원주시 공식 연혁", sourceUrl: "https://www.wonju.go.kr/www/contents.do?key=231", relatedRoute: "/history" },
  { id: "city-1955", topic: "history", text: "원주읍이 원주시로 승격된 해는 1955년이에요.", sourceLabel: "원주시 공식 연혁", sourceUrl: "https://www.wonju.go.kr/www/contents.do?key=231", relatedRoute: "/history" },
  { id: "gamyeong-500", topic: "history", text: "강원감영은 1395년부터 1895년까지 약 500년 동안 강원 행정의 중심지였어요.", sourceLabel: "원주관광 강원감영", sourceUrl: "https://www.wonju.go.kr/tour/contents.do?key=5523", relatedRoute: "/history" },
  { id: "gamyeong-26", topic: "history", text: "원주의 강원감영은 조선시대 강원도 26개 부·목·군·현을 관할했어요.", sourceLabel: "원주시역사박물관", sourceUrl: "https://whm.wonju.go.kr/whm/page/view.php/sub_07_01", relatedRoute: "/history" },
  { id: "gamyeong-40", topic: "place", text: "전성기 강원감영에는 선화당을 비롯해 약 40동의 건물이 있었다고 전해져요.", sourceLabel: "원주관광 강원감영", sourceUrl: "https://www.wonju.go.kr/tour/contents.do?key=5523", relatedRoute: "/discover" },
  { id: "gamyeong-fire", topic: "history", text: "강원감영 건물은 임진왜란이 일어난 1592년에 대부분 불탔고, 1634년부터 다시 지어졌어요.", sourceLabel: "원주관광 강원감영", sourceUrl: "https://www.wonju.go.kr/tour/contents.do?key=5523", relatedRoute: "/history" },
  { id: "gamyeong-restore", topic: "place", text: "현재 볼 수 있는 강원감영 일부는 2000년부터 2005년까지 진행된 복원 사업으로 되살아났어요.", sourceLabel: "원주관광 강원감영", sourceUrl: "https://www.wonju.go.kr/tour/contents.do?key=5523", relatedRoute: "/discover" },
  { id: "seonhwadang", topic: "place", text: "강원감영의 중심 건물 선화당은 조선시대 감영의 중심 건물 가운데 현재까지 남은 사례예요.", sourceLabel: "원주시역사박물관", sourceUrl: "https://whm.wonju.go.kr/whm/page/view.php/sub_07_01", relatedRoute: "/discover" },
  { id: "unesco-2019", topic: "literature", text: "원주는 2019년 유네스코 문학 창의도시 네트워크에 가입했어요.", sourceLabel: "원주 유네스코 문학 창의도시", sourceUrl: "https://www.wonju.go.kr/cityofliterature/user_sub.php?gid=www&mu_idx=356", relatedRoute: "/history" },
  { id: "unesco-29", topic: "literature", text: "원주는 전 세계에서 29번째로 유네스코 문학 창의도시가 된 도시예요.", sourceLabel: "원주 유네스코 문학 창의도시", sourceUrl: "https://www.wonju.go.kr/cityofliterature/user_sub.php?gid=www&mu_idx=356", relatedRoute: "/history" },
  { id: "toji-26", topic: "literature", text: "박경리의 『토지』는 1969년부터 1994년까지 26년에 걸쳐 완성됐고, 마지막 작업의 터가 원주였어요.", sourceLabel: "원주 유네스코 문학 창의도시", sourceUrl: "https://www.wonju.go.kr/cityofliterature/user_sub.php?gid=www&mu_idx=356", relatedRoute: "/history" },
  { id: "park-wonju", topic: "people", text: "박경리는 1980년부터 2008년까지 원주에서 살며 『토지』 4·5부를 집필했어요.", sourceLabel: "박경리문학공원", sourceUrl: "https://www.wonju.go.kr/cityofliterature/user_sub.php?gid=www&mu_idx=253", relatedRoute: "/history" },
  { id: "one-book-2004", topic: "culture", text: "원주의 ‘한 도시 한 책 읽기’ 운동은 2004년에 시작됐어요.", sourceLabel: "원주 유네스코 문학 창의도시", sourceUrl: "https://www.wonju.go.kr/cityofliterature/user_sub.php?gid=www&mu_idx=254", relatedRoute: "/events" },
  { id: "one-book-450k", topic: "culture", text: "원주 ‘한 도시 한 책 읽기’에는 첫 16년 동안 45만 명 넘는 시민이 참여했어요.", sourceLabel: "원주 유네스코 문학 창의도시", sourceUrl: "https://www.wonju.go.kr/cityofliterature/user_sub.php?gid=www&mu_idx=254", relatedRoute: "/history" },
  { id: "yun-contest", topic: "culture", text: "연세대학교 미래캠퍼스에서는 2001년부터 윤동주 백일장이 이어지고 있어요.", sourceLabel: "원주 유네스코 문학 창의도시", sourceUrl: "https://www.wonju.go.kr/cityofliterature/user_sub.php?gid=www&mu_idx=256", relatedRoute: "/events" },
  { id: "sights-temples", topic: "place", text: "원주 8경에는 구룡사와 상원사, 치악산 비로봉이 함께 꼽혀요.", sourceLabel: "원주관광", sourceUrl: "https://www.wonju.go.kr/tour/main.do", relatedRoute: "/discover" },
  { id: "sights-gamyeong", topic: "place", text: "강원감영은 자연 명소들과 나란히 원주 8경에 포함된 도심 역사 명소예요.", sourceLabel: "원주관광", sourceUrl: "https://www.wonju.go.kr/tour/main.do", relatedRoute: "/discover" },
  { id: "sights-cathedral", topic: "place", text: "용소막성당도 원주 8경 가운데 하나예요.", sourceLabel: "원주관광", sourceUrl: "https://www.wonju.go.kr/tour/main.do", relatedRoute: "/discover" },
  { id: "sights-fortress", topic: "place", text: "영원산성과 미륵산 미륵불상은 원주 8경에 이름을 올린 역사 유적이에요.", sourceLabel: "원주관광", sourceUrl: "https://www.wonju.go.kr/tour/main.do", relatedRoute: "/discover" },
  { id: "im-yunjidang", topic: "people", text: "임윤지당은 원주를 대표하는 조선 후기 여성 성리학자이며, 원주역사박물관이 선양관을 운영해요.", sourceLabel: "원주시역사박물관", sourceUrl: "https://whm.wonju.go.kr/whm/page/view.php/sub_09_01", relatedRoute: "/history" },
  { id: "choi-kyuha", topic: "people", text: "원주 출신 최규하 전 대통령의 유품은 원주시역사박물관 현석실에서 다뤄져요.", sourceLabel: "원주시역사박물관", sourceUrl: "https://whm.wonju.go.kr/whm/page/view.php/sub_02_01_04", relatedRoute: "/history" },
] as const;
