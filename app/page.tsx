"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CameraButton from "./components/CameraButton";

const heroSlides = [
	{
		title: "大仙古墳",
		image: "/assets/sakai_image/daisen.jpg",
	},
	{
		title: "さかい利晶の杜",
		image: "/assets/sakai_image/risho.jpeg",
	},
	{
		title: "旧堺燈台",
		image: "/assets/sakai_image/sakaitodai.jpg",
	},
];

const announcementCards = [
	{
		title: "ARスタンプラリー2026がスタートしました！堺の観光地を巡ろう。",
		date: "2026.10.28",
	},
	{
		title: "大仙公園エリアで新しいキャラクター「にんとくくん」が登場！",
		date: "2026.10.20",
	},
	{
		title: "システムメンテナンスのお知らせ（11月1日深夜）",
		date: "2026.10.15",
	},
];

const newsCards = [
	{
		title: "堺の伝統工芸「刃物」体験イベントが今週末に開催決定。",
		date: "2026.10.25",
	},
	{
		title: "秋の特別拝観：妙國寺の樹齢400年「大ソテツ」公開。",
		date: "2026.10.18",
	},
];

const contactCards = [
	{
		title: "アプリの操作方法・カメラが起動しない場合のご案内",
		date: "よくある質問",
	},
	{
		title: "観光ガイド・イベントに関するお問い合わせフォーム",
		date: "お問い合わせ",
	},
];

export default function Home() {
	const router = useRouter();
	const [menuOpen, setMenuOpen] = useState(false);
	const [currentSlide, setCurrentSlide] = useState(0);

	const routeStamp = () => router.push("/stamp");
	const routeMap = () => router.push("/map");
	const closeMenu = () => setMenuOpen(false);

	useEffect(() => {
		const intervalId = window.setInterval(() => {
			setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
		}, 3500);

		return () => window.clearInterval(intervalId);
	}, []);

	const renderCards = (items: { title: string; date: string }[]) =>
		items.map((item) => (
			<Link href="/stamp" key={item.title} className="content-card">
				<div className="card-title">{item.title}</div>
				<div className="card-date">{item.date}</div>
			</Link>
		));

	return (
		<main className="home-page">
			<header className="app-header">
				<div className="header-title">
					<h1>堺観光ARアプリ</h1>
					<span>Sakai Tourism AR App</span>
				</div>

				<button
					type="button"
					className="hamburger-btn"
					aria-label="メニューを開く"
					onClick={() => setMenuOpen(true)}
				>
					<span className="bar" />
					<span className="bar" />
					<span className="bar" />
				</button>
			</header>

			<div
				className={`drawer-overlay ${menuOpen ? "active" : ""}`}
				onClick={closeMenu}
			/>

			<nav
				className={`drawer-menu ${menuOpen ? "active" : ""}`}
				aria-label="メニュー"
			>
				<button
					type="button"
					className="close-btn"
					aria-label="メニューを閉じる"
					onClick={closeMenu}
				>
					✕
				</button>

				<ul className="drawer-nav-list">
					<li>
						<Link href="/webar?autostart=1" onClick={closeMenu}>
							カメラ起動
						</Link>
					</li>
					<li>
						<Link href="/stamp" onClick={closeMenu}>
							スタンプ帳
						</Link>
					</li>
					<li>
						<Link href="/map" onClick={closeMenu}>
							マップ
						</Link>
					</li>
				</ul>
			</nav>

			<section
				className="hero-slider-section"
				aria-label="観光地スライダー"
			>
				<div className="slider-container">
					{heroSlides.map((slide, index) => (
						<div
							key={slide.title}
							className={`slide-item ${index === currentSlide ? "active" : ""}`}
							style={{ backgroundImage: `url(${slide.image})` }}
						>
							<div className="slide-title">{slide.title}</div>
						</div>
					))}
				</div>

				<div className="slider-dots" aria-label="スライド切替">
					{heroSlides.map((slide, index) => (
						<button
							type="button"
							key={slide.title}
							aria-label={`${slide.title}を表示`}
							className={`dot ${index === currentSlide ? "active" : ""}`}
							onClick={() => setCurrentSlide(index)}
						/>
					))}
				</div>
			</section>

			<main className="main-content">
				<section className="content-section">
					<Link href="/stamp" className="section-badge-link">
						<div className="section-badge">
							<span className="badge-ja">お知らせ</span>
							<span className="badge-en">Announcements</span>
						</div>
					</Link>
					<div className="horizontal-scroll-container">
						{renderCards(announcementCards)}
						<Link href="/stamp" className="content-card more-card">
							<div className="more-card-inner">
								<span>もっと見る</span>
								<span className="more-arrow">→</span>
							</div>
						</Link>
					</div>
				</section>

				<section className="content-section">
					<Link href="/map" className="section-badge-link">
						<div className="section-badge">
							<span className="badge-ja">ニュース</span>
							<span className="badge-en">News</span>
						</div>
					</Link>
					<div className="horizontal-scroll-container">
						{renderCards(newsCards)}
						<Link href="/map" className="content-card more-card">
							<div className="more-card-inner">
								<span>もっと見る</span>
								<span className="more-arrow">→</span>
							</div>
						</Link>
					</div>
				</section>

				<section className="content-section">
					<Link href="/webar?autostart=1" className="section-badge-link">
						<div className="section-badge">
							<span className="badge-ja">お問い合わせ</span>
							<span className="badge-en">Contact Us</span>
						</div>
					</Link>
					<div className="horizontal-scroll-container">
						{renderCards(contactCards)}
						<Link href="/webar?autostart=1" className="content-card more-card">
							<div className="more-card-inner">
								<span>もっと見る</span>
								<span className="more-arrow">→</span>
							</div>
						</Link>
					</div>
				</section>
			</main>

			<nav className="bottom-nav" aria-label="下部ナビゲーション">
				<button
					type="button"
					className="bottom-nav-btn nav-left"
					onClick={routeMap}
				>
					<svg
						className="nav-icon"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
					>
						<path d="M3 9.5L12 4l9 5.5v9.5L12 20l-9-5.5v-5z" />
						<path d="M12 4v16" />
						<path d="M3 9.5l9 5.5 9-5.5" />
					</svg>
					<div className="nav-label-box">
						<span className="nav-label-ja">マップ</span>
						<span className="nav-label-en">Map</span>
					</div>
				</button>

				<div className="nav-center-camera-wrapper">
					<CameraButton className="nav-center-camera" />
				</div>

				<button
					type="button"
					className="bottom-nav-btn nav-right"
					onClick={routeStamp}
				>
					<svg
						className="nav-icon"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
					>
						<rect x="4" y="2" width="16" height="20" rx="2" />
						<path d="M8 6h8M8 10h8M8 14h8" />
					</svg>
					<div className="nav-label-box">
						<span className="nav-label-ja">スタンプ</span>
						<span className="nav-label-en">Stamp</span>
					</div>
				</button>
			</nav>
		</main>
	);
}