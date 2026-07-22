-- ============================================================
-- Restaurant FAQ Knowledge Base Seed Data
-- For: Authentic Flavors by Chef Ramos
-- Location: 35 ML Quezon St. New Lower Bicutan, Taguig City
-- Hours: 11am - 10pm Tuesday - Sunday (Closed on Mondays)
-- Established: November 2023
-- Use: Chatbot first checks this table before calling Gemini API
-- ============================================================

INSERT INTO knowledge_base (category, question, answer, status) VALUES

-- ====== HOURS & LOCATION ======
('Hours & Location', 'What are your operating hours?', 'We are open Tuesday to Sunday from 11:00 AM to 10:00 PM. We are closed on Mondays.', 'Active'),
('Hours & Location', 'Where are you located?', 'Authentic Flavors is located at 35 ML Quezon St. New Lower Bicutan, Taguig City, Philippines.', 'Active'),
('Hours & Location', 'Do you offer takeout or delivery?', 'Yes, we offer both takeout and delivery services. You can place your order by calling us at (02) 8123-4567 or through our website under the Packages page.', 'Active'),
('Hours & Location', 'Do you have parking available?', 'Yes, we have dedicated event parking available for our guests.', 'Active'),
('Hours & Location', 'Are you open on holidays?', 'We are open on most holidays except Christmas Day, New Year''s Day, and Mondays (our regular rest day). We may have special holiday hours, so feel free to call ahead to confirm.', 'Active'),
('Hours & Location', 'Why are you closed on Mondays?', 'We are closed on Mondays to give our team a rest day and to prepare fresh ingredients for the week ahead. We look forward to serving you Tuesday through Sunday!', 'Active'),

-- ====== RESERVATIONS ======
('Reservations', 'How do I make a reservation?', 'You can make a reservation by visiting our Book a Package page on our website, or by calling us at (02) 8123-4567. We recommend booking at least 24 hours in advance.', 'Active'),
('Reservations', 'What is your cancellation policy?', 'You may cancel or modify your reservation free of charge up to 4 hours before your scheduled time. Late cancellations or no-shows may be charged a fee of ₱500 per person.', 'Active'),
('Reservations', 'Do you accept walk-ins?', 'Yes, we welcome walk-ins! However, table availability is subject to the current occupancy. Reservations are recommended, especially on weekends and holidays.', 'Active'),
('Reservations', 'Is there a dress code?', 'We maintain a smart casual dress code. We kindly ask guests to refrain from wearing slippers, swimwear, or sleeveless shirts for gentlemen.', 'Active'),
('Reservations', 'Can I book the entire restaurant for a private event?', 'Absolutely! Our venue can accommodate a maximum of 70 guests for private events. Please contact our events team at events@authenticflavors.com or call (02) 8123-4567 for more details.', 'Active'),
('Reservations', 'What is the maximum number of guests you can accommodate?', 'Our venue can accommodate a maximum of 70 guests for seated events.', 'Active'),

-- ====== MENU & FOOD ======
('Menu & Food', 'What type of cuisine do you serve?', 'Authentic Flavors serves modern Filipino cuisine with a contemporary twist. Chef Ramos started the business during the pandemic with sisig and chicken wings, and has since expanded into a full-service restaurant offering a wide variety of dishes.', 'Active'),
('Menu & Food', 'Do you have vegetarian or vegan options?', 'Yes, we have a variety of vegetarian and vegan dishes available. Our menu is clearly marked, and our staff can assist you with any dietary preferences or restrictions.', 'Active'),
('Menu & Food', 'Do you accommodate food allergies?', 'Yes, we take food allergies seriously. Please inform your server of any allergies when ordering, and our kitchen will take the necessary precautions. However, please note that our kitchen handles common allergens.', 'Active'),
('Menu & Food', 'Do you offer a tasting menu?', 'Yes, Chef Ramos offers a seasonal tasting menu featuring 6 to 8 courses that showcase the best of Filipino cuisine. The tasting menu is available for ₱1,800 per person and requires a minimum of 2 guests.', 'Active'),
('Menu & Food', 'Do you have a children''s menu?', 'Yes, we offer a children''s menu for guests aged 10 and below, with kid-friendly options starting at ₱250 per meal.', 'Active'),
('Menu & Food', 'Are your dishes halal-certified?', 'While we use halal-certified chicken and beef from trusted suppliers, our restaurant is not fully halal-certified. Please speak with our manager for more details.', 'Active'),
('Menu & Food', 'Do you serve alcoholic beverages?', 'Yes, we have a selection of local and imported wines, beers, and signature cocktails. We also offer non-alcoholic mocktails for guests who prefer them.', 'Active'),

-- ====== PRICING & PAYMENT ======
('Pricing & Payment', 'What payment methods do you accept?', 'We accept cash, all major credit and debit cards (Visa, Mastercard, American Express), GCash, Maya, and online banking transfers.', 'Active'),
('Pricing & Payment', 'Is service charge included?', 'A 10% service charge is added to all bills. Any additional gratuity is at the discretion of our guests.', 'Active'),
('Pricing & Payment', 'Do you have any ongoing promos or discounts?', 'Yes! We have a Lunch Special promo from 11:00 AM to 1:00 PM on weekdays with 15% off selected dishes. Senior citizens and PWDs also enjoy a 20% discount as mandated by law.', 'Active'),
('Pricing & Payment', 'What are your price ranges for main courses?', 'Our main courses range from ₱350 to ₱1,200. Appetizers start at ₱180, and desserts are between ₱120 and ₱350.', 'Active'),
('Pricing & Payment', 'Can I split the bill?', 'Yes, we allow bill splitting for groups. Each split payment can be made via cash or card for your convenience.', 'Active'),

-- ====== CATERING & EVENTS ======
('Catering & Events', 'Do you offer catering services?', 'Yes, we offer full-service catering for events of all sizes. Our catering packages include appetizers, main courses, and desserts. Visit our Packages page for more details.', 'Active'),
('Catering & Events', 'What event packages do you offer?', 'We offer several packages: Family Fiesta (from ₱5,000 for 10 pax), Corporate Dinners (from ₱15,000 for 20 pax), Birthday Celebrations (from ₱8,000 for 15 pax), Wedding Receptions (from ₱50,000), and Anniversary Dinners (from ₱10,000 for 10 pax).', 'Active'),
('Catering & Events', 'How far in advance should I book for an event?', 'We recommend booking at least 2 weeks in advance for small events and 1 month in advance for large events to ensure availability and proper preparations.', 'Active'),
('Catering & Events', 'Do you provide event setup and decoration?', 'Yes, our events team provides basic setup and decoration as part of our packages. Custom decorations and themes can be arranged for an additional fee.', 'Active'),
('Catering & Events', 'Can I bring my own cake for an event?', 'Yes, you may bring your own cake for celebrations. A corkage fee of ₱200 per cake applies, and we will be happy to serve it to your guests.', 'Active'),
('Catering & Events', 'Do you offer tasting sessions before booking an event?', 'Yes, we offer complimentary tasting sessions for events with 30 or more guests. For smaller events, a tasting fee of ₱500 per person applies, which will be deducted from your final bill.', 'Active'),

-- ====== ABOUT THE RESTAURANT ======
('About the Restaurant', 'When was the restaurant established?', 'Authentic Flavors was officially established in November 2023. It started as a home-based online food business during the pandemic, initially selling sisig and chicken wings, before growing into a full-service dining restaurant.', 'Active'),
('About the Restaurant', 'Who is Chef Ramos?', 'Chef Ramos is the Executive Chef and Founder of Authentic Flavors. He started the business during the pandemic as a home-based online food service, selling sisig and chicken wings. Through quality food, excellent service, and online promotion, the business grew into the restaurant it is today.', 'Active'),
('About the Restaurant', 'What is the venue capacity?', 'Our venue can accommodate a maximum of 70 guests. It offers an exclusive, intimate setting perfect for birthdays, weddings, corporate dinners, and other milestones.', 'Active'),

-- ====== CONTACT & SUPPORT ======
('Contact & Support', 'How can I contact the restaurant?', 'You can reach us via phone at (02) 8123-4567, email at info@authenticflavors.com, or through the contact form on our website. For event inquiries, email events@authenticflavors.com.', 'Active'),
('Contact & Support', 'Do you have a loyalty program?', 'Yes, our Authentic Flavors Loyalty Card program rewards you with points for every visit. Earn 1 point for every ₱100 spent, and redeem 50 points for a free appetizer or dessert.', 'Active'),
('Contact & Support', 'Is Wi-Fi available?', 'Yes, free Wi-Fi is available for all guests. Ask your server for the password upon arrival.', 'Active'),
('Contact & Support', 'Are you available on social media?', 'Yes, follow us on Facebook, Instagram, and TikTok at @authenticflavorsph for updates, promos, and behind-the-scenes content.', 'Active'),
('Contact & Support', 'How do I provide feedback about my experience?', 'We value your feedback! You can fill out our feedback form on the website, leave us a review on Google or Facebook, or speak directly with our manager during your visit.', 'Active');

-- Verify inserted data
SELECT COUNT(*) AS total_entries FROM knowledge_base;
SELECT category, COUNT(*) AS entries FROM knowledge_base GROUP BY category ORDER BY category;