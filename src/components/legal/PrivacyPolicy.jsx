import React from 'react';

const PrivacyPolicy = () => {
	return (
		<div className="max-w-3xl mx-auto px-4 py-10 text-gray-800">
			<h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
			<p className="mb-4 text-sm text-gray-600">Version 1.0 • Last updated {new Date().toLocaleDateString()}</p>

			<p className="mb-4">
				We are committed to protecting your personal data. This Privacy Policy explains how we collect, use, and safeguard your
				information in compliance with the UK GDPR and EU GDPR.
			</p>

			<h2 className="text-xl font-semibold mt-6 mb-2">Data Controller</h2>
			<p className="mb-4">The Discourse AI (contact: privacy@thediscourse.ai)</p>

			<h2 className="text-xl font-semibold mt-6 mb-2">What data we collect</h2>
			<ul className="list-disc ml-6 mb-4">
				<li>Account data: name, email, password hash</li>
				<li>Usage data: app interactions, diagnostics, and service logs</li>
				<li>Payment data: processed by Stripe; we do not store full card details</li>
			</ul>

			<h2 className="text-xl font-semibold mt-6 mb-2">Why we process your data (legal bases)</h2>
			<ul className="list-disc ml-6 mb-4">
				<li>To create and manage your account (contract necessity)</li>
				<li>To provide core app functionality (contract necessity)</li>
				<li>To communicate important service updates (legitimate interests)</li>
				<li>To comply with legal obligations</li>
				<li>Optional communications (consent, where applicable)</li>
			</ul>

			<h2 className="text-xl font-semibold mt-6 mb-2">Your rights</h2>
			<ul className="list-disc ml-6 mb-4">
				<li>Access, rectification, erasure</li>
				<li>Restriction and objection to processing</li>
				<li>Data portability</li>
				<li>Withdraw consent at any time (does not affect prior processing)</li>
				<li>Complain to your local data protection authority</li>
			</ul>

			<h2 className="text-xl font-semibold mt-6 mb-2">Data retention</h2>
			<p className="mb-4">We retain your data only as long as necessary for the purposes above or as required by law.</p>

			<h2 className="text-xl font-semibold mt-6 mb-2">International transfers</h2>
			<p className="mb-4">Where data is transferred outside the UK/EU, we use appropriate safeguards (e.g., Standard Contractual Clauses).</p>

			<h2 className="text-xl font-semibold mt-6 mb-2">Contact</h2>
			<p className="mb-4">To exercise your rights or ask questions, contact privacy@thediscourse.ai.</p>
		</div>
	);
};

export default PrivacyPolicy; 