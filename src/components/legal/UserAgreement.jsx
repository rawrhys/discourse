import React from 'react';

const UserAgreement = () => {
	return (
		<div className="max-w-4xl mx-auto px-4 py-10 text-gray-800">
			<h1 className="text-3xl font-bold mb-6">User Agreement & Terms of Service</h1>
			<p className="mb-6 text-sm text-gray-600">Version 1.0 • Last updated {new Date().toLocaleDateString()}</p>

			<div className="space-y-8">
				{/* AI Content Disclaimer */}
				<section className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-r-lg">
					<h2 className="text-xl font-semibold text-yellow-800 mb-4">⚠️ Important AI Content Disclaimer</h2>
					<div className="text-yellow-700 space-y-3">
						<p><strong>AI-Generated Content:</strong> This platform uses artificial intelligence to generate educational content. While we strive for accuracy, AI systems are prone to:</p>
						<ul className="list-disc ml-6 space-y-2">
							<li><strong>Hallucinations:</strong> AI may generate false or misleading information that appears factual</li>
							<li><strong>Inaccuracies:</strong> Content may contain errors, outdated information, or incorrect facts</li>
							<li><strong>Bias:</strong> AI-generated content may reflect biases present in training data</li>
							<li><strong>Context Errors:</strong> AI may misunderstand context or provide inappropriate responses</li>
						</ul>
						<p><strong>Educational Use Only:</strong> All content is for educational purposes only and should not be considered as professional, legal, medical, or financial advice.</p>
					</div>
				</section>

				{/* Acceptance of Terms */}
				<section>
					<h2 className="text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
					<p className="mb-4">By accessing or using The Discourse AI platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the Service.</p>
					<p className="mb-4">You must be at least 13 years old to use this Service. If you are under 18, you must have parental or guardian consent to use the Service.</p>
				</section>

				{/* Service Description */}
				<section>
					<h2 className="text-xl font-semibold mb-4">2. Service Description</h2>
					<p className="mb-4">The Discourse AI provides an AI-powered educational content generation platform that creates courses, lessons, and learning materials. The Service includes:</p>
					<ul className="list-disc ml-6 mb-4 space-y-2">
						<li>AI-generated educational content</li>
						<li>Course creation and management tools</li>
						<li>Public course sharing capabilities</li>
						<li>Quiz and assessment features</li>
						<li>Image search and integration</li>
					</ul>
				</section>

				{/* User Responsibilities */}
				<section>
					<h2 className="text-xl font-semibold mb-4">3. User Responsibilities</h2>
					<p className="mb-4">You agree to:</p>
					<ul className="list-disc ml-6 mb-4 space-y-2">
						<li>Provide accurate and complete registration information</li>
						<li>Maintain the security of your account credentials</li>
						<li>Use the Service only for lawful educational purposes</li>
						<li>Not attempt to circumvent any security measures</li>
						<li>Not use the Service to generate harmful, illegal, or inappropriate content</li>
						<li>Respect intellectual property rights</li>
						<li>Not attempt to reverse engineer or hack the Service</li>
					</ul>
				</section>

				{/* Content Guidelines */}
				<section>
					<h2 className="text-xl font-semibold mb-4">4. Content Guidelines</h2>
					<p className="mb-4">You agree not to request or generate content that:</p>
					<ul className="list-disc ml-6 mb-4 space-y-2">
						<li>Contains explicit sexual content, pornography, or NSFW material</li>
						<li>Promotes violence, terrorism, or extremist ideologies</li>
						<li>Contains hate speech, discrimination, or harassment</li>
						<li>Provides instructions for illegal activities</li>
						<li>Infringes on intellectual property rights</li>
						<li>Contains personal information of others without consent</li>
						<li>Is intended to deceive or mislead</li>
					</ul>
				</section>

				{/* AI Content Limitations */}
				<section>
					<h2 className="text-xl font-semibold mb-4">5. AI Content Limitations & Disclaimers</h2>
					<div className="bg-gray-50 p-4 rounded-lg">
						<p className="mb-4"><strong>No Guarantee of Accuracy:</strong> While we employ content moderation and quality controls, we cannot guarantee the accuracy, completeness, or reliability of AI-generated content.</p>
						
						<p className="mb-4"><strong>Educational Use Only:</strong> All content is provided for educational purposes only. Users should:</p>
						<ul className="list-disc ml-6 mb-4 space-y-2">
							<li>Verify information from authoritative sources</li>
							<li>Not rely solely on AI-generated content for critical decisions</li>
							<li>Use content as a starting point for further research</li>
							<li>Exercise critical thinking and judgment</li>
						</ul>

						<p className="mb-4"><strong>No Professional Advice:</strong> AI-generated content does not constitute professional, legal, medical, financial, or other expert advice.</p>

						<p className="mb-4"><strong>Content Evolution:</strong> AI models are continuously updated, which may affect content generation patterns and accuracy over time.</p>
					</div>
				</section>

				{/* Intellectual Property */}
				<section>
					<h2 className="text-xl font-semibold mb-4">6. Intellectual Property</h2>
					<p className="mb-4"><strong>Your Content:</strong> You retain ownership of content you create using the Service, subject to our right to use it for service provision and improvement.</p>
					<p className="mb-4"><strong>AI-Generated Content:</strong> AI-generated content may be subject to third-party intellectual property rights. You are responsible for ensuring your use complies with applicable laws.</p>
					<p className="mb-4"><strong>Platform Rights:</strong> The Service, including its software, design, and content, is owned by The Discourse AI and protected by intellectual property laws.</p>
				</section>

				{/* Privacy & Data */}
				<section>
					<h2 className="text-xl font-semibold mb-4">7. Privacy & Data Protection</h2>
					<p className="mb-4">Your privacy is important to us. Our collection and use of personal information is governed by our Privacy Policy, which is incorporated into these Terms by reference.</p>
					<p className="mb-4">We implement appropriate technical and organizational measures to protect your data, but no method of transmission over the internet is 100% secure.</p>
				</section>

				{/* Payment Terms */}
				<section>
					<h2 className="text-xl font-semibold mb-4">8. Payment Terms</h2>
					<p className="mb-4">Some features of the Service require payment. All payments are processed securely through Stripe. Prices are subject to change with notice.</p>
					<p className="mb-4">Refunds are provided at our discretion and in accordance with applicable consumer protection laws.</p>
				</section>

				{/* Limitation of Liability */}
				<section className="bg-red-50 border-l-4 border-red-400 p-6 rounded-r-lg">
					<h2 className="text-xl font-semibold text-red-800 mb-4">9. Limitation of Liability</h2>
					<div className="text-red-700 space-y-3">
						<p><strong>To the maximum extent permitted by law, The Discourse AI shall not be liable for:</strong></p>
						<ul className="list-disc ml-6 space-y-2">
							<li>Any inaccuracies, errors, or omissions in AI-generated content</li>
							<li>Decisions made based on AI-generated content</li>
							<li>Any damages arising from the use or inability to use the Service</li>
							<li>Indirect, incidental, special, consequential, or punitive damages</li>
							<li>Loss of data, profits, or business opportunities</li>
						</ul>
						<p><strong>Our total liability shall not exceed the amount you paid for the Service in the 12 months preceding the claim.</strong></p>
					</div>
				</section>

				{/* Indemnification */}
				<section>
					<h2 className="text-xl font-semibold mb-4">10. Indemnification</h2>
					<p className="mb-4">You agree to indemnify and hold harmless The Discourse AI from any claims, damages, or expenses arising from:</p>
					<ul className="list-disc ml-6 mb-4 space-y-2">
						<li>Your use of the Service</li>
						<li>Your violation of these Terms</li>
						<li>Your violation of any third-party rights</li>
						<li>Any content you create or share using the Service</li>
					</ul>
				</section>

				{/* Service Availability */}
				<section>
					<h2 className="text-xl font-semibold mb-4">11. Service Availability</h2>
					<p className="mb-4">We strive to maintain high availability but do not guarantee uninterrupted access to the Service. We may suspend or terminate the Service for maintenance, security, or other reasons.</p>
				</section>

				{/* Termination */}
				<section>
					<h2 className="text-xl font-semibold mb-4">12. Termination</h2>
					<p className="mb-4">We may terminate or suspend your account immediately, without prior notice, for conduct that we believe violates these Terms or is harmful to other users or the Service.</p>
					<p className="mb-4">You may terminate your account at any time by contacting us. Upon termination, your right to use the Service ceases immediately.</p>
				</section>

				{/* Governing Law */}
				<section>
					<h2 className="text-xl font-semibold mb-4">13. Governing Law</h2>
					<p className="mb-4">These Terms are governed by the laws of the United Kingdom. Any disputes shall be resolved in the courts of the United Kingdom.</p>
				</section>

				{/* Changes to Terms */}
				<section>
					<h2 className="text-xl font-semibold mb-4">14. Changes to Terms</h2>
					<p className="mb-4">We reserve the right to modify these Terms at any time. We will notify users of material changes via email or through the Service. Continued use of the Service after changes constitutes acceptance of the new Terms.</p>
				</section>

				{/* Contact Information */}
				<section>
					<h2 className="text-xl font-semibold mb-4">15. Contact Information</h2>
					<p className="mb-4">For questions about these Terms, please contact us at:</p>
					<div className="bg-gray-50 p-4 rounded-lg">
						<p><strong>Email:</strong> legal@thediscourse.ai</p>
						<p><strong>Address:</strong> The Discourse AI, [Your Business Address]</p>
					</div>
				</section>

				{/* Final Disclaimer */}
				<section className="bg-blue-50 border-l-4 border-blue-400 p-6 rounded-r-lg">
					<h2 className="text-xl font-semibold text-blue-800 mb-4">Important Notice</h2>
					<div className="text-blue-700">
						<p className="mb-4">By using The Discourse AI, you acknowledge that:</p>
						<ul className="list-disc ml-6 space-y-2">
							<li>AI-generated content may contain inaccuracies or hallucinations</li>
							<li>You will verify important information from authoritative sources</li>
							<li>You use the Service at your own risk</li>
							<li>We are not responsible for decisions made based on AI-generated content</li>
						</ul>
						<p className="mt-4 font-semibold">This agreement constitutes a legally binding contract between you and The Discourse AI.</p>
					</div>
				</section>
			</div>
		</div>
	);
};

export default UserAgreement;
