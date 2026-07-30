# 대한민국 시군구 기능용 지도 출처

- 원자료: 통계청 SGIS Open API 행정구역 경계
- 가공 자료: [StatGarten maps](https://github.com/statgarten/maps)
- 가공 자료 기준연도: 2020년
- 가공 자료 라이선스: MIT License, Copyright (c) 2022 StatGarten
- 생성 파일: `korea-sigungu.svg`, `korea-sigungu.meta.json`

이 지도는 Travel Bingo의 지역 선택, 사진 마스킹, 동·은·금 테두리 기능을
검증하기 위한 기능용 초안입니다. 최종 출시 전에는 공공데이터포털에서 제공하는
2025년 SGIS 행정구역 경계 패키지와 참고자료의 이용 조건을 다시 확인하고,
`scripts/build-korea-exploration-map.mjs`를 이용해 최신 경계로 교체합니다.

## MIT License

Copyright (c) 2022 StatGarten

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
