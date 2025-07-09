"use strict";

const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcryptjs");

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create users first
    const hashedPassword = await bcrypt.hash("password123", 10);

    const users = [
      {
        id: uuidv4(),
        name: "Admin User",
        email: "admin@example.com",
        password: hashedPassword,
        role: "admin",
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        name: "Regular User",
        email: "user@example.com",
        password: hashedPassword,
        role: "user",
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    await queryInterface.bulkInsert("users", users);

    // Create organizations
    const organizations = [
      {
        id: uuidv4(),
        name: "Tech Solutions Inc",
        address: "123 Tech Street, Silicon Valley, CA 94000",
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        name: "Global Consulting Group",
        address: "456 Business Ave, New York, NY 10001",
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    await queryInterface.bulkInsert("organizations", organizations);

    // Create user-organization relationships
    const userOrganizations = [
      {
        id: uuidv4(),
        user_id: users[0].id,
        organization_id: organizations[0].id,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        user_id: users[1].id,
        organization_id: organizations[0].id,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        user_id: users[0].id,
        organization_id: organizations[1].id,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    await queryInterface.bulkInsert("user_organizations", userOrganizations);

    // Create customers
    const customers = [
      {
        id: uuidv4(),
        name: "ABC Corporation",
        contact_email: "contact@abccorp.com",
        contact_phone: "+1-555-0123",
        description: "Leading technology company",
        address: "789 Corporate Blvd, Downtown, CA 90210",
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        name: "XYZ Industries",
        contact_email: "info@xyzind.com",
        contact_phone: "+1-555-0456",
        description: "Manufacturing and industrial solutions",
        address: "321 Industrial Park, Manufacturing City, TX 75001",
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    await queryInterface.bulkInsert("customers", customers);

    // Create processes (independent of customers)
    const processes = [
      {
        id: uuidv4(),
        name: "Software Development",
        description: "Standard software development process",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        name: "Business Consulting",
        description: "Strategic business consulting services",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        name: "Project Management",
        description: "Project planning and management activities",
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    await queryInterface.bulkInsert("processes", processes);

    // Create activities for processes
    const activities = [
      // Software Development activities
      {
        id: uuidv4(),
        process_id: processes[0].id,
        name: "Coding",
        description: "Writing and implementing code",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        process_id: processes[0].id,
        name: "Testing",
        description: "Testing and quality assurance",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        process_id: processes[0].id,
        name: "Code Review",
        description: "Reviewing and approving code changes",
        created_at: new Date(),
        updated_at: new Date(),
      },
      // Business Consulting activities
      {
        id: uuidv4(),
        process_id: processes[1].id,
        name: "Analysis",
        description: "Business analysis and research",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        process_id: processes[1].id,
        name: "Client Meeting",
        description: "Meetings with clients and stakeholders",
        created_at: new Date(),
        updated_at: new Date(),
      },
      // Project Management activities
      {
        id: uuidv4(),
        process_id: processes[2].id,
        name: "Planning",
        description: "Project planning and scheduling",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        process_id: processes[2].id,
        name: "Monitoring",
        description: "Project monitoring and tracking",
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    await queryInterface.bulkInsert("activities", activities);

    // Create sample time entries
    const timeEntries = [
      {
        id: uuidv4(),
        user_id: users[1].id,
        organization_id: organizations[0].id,
        customer_id: customers[0].id,
        process_id: processes[0].id,
        activity_id: activities[0].id,
        date: new Date().toISOString().split("T")[0],
        start_time: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        end_time: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        duration: 120, // 2 hours in minutes
        work_location_type: "organization",
        work_location_address: organizations[0].address,
        notes: "Implemented new feature for the client portal",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        user_id: users[1].id,
        organization_id: organizations[0].id,
        customer_id: customers[1].id,
        process_id: processes[1].id,
        activity_id: activities[3].id,
        date: new Date().toISOString().split("T")[0],
        start_time: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        end_time: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        duration: 120, // 2 hours in minutes
        work_location_type: "customer",
        work_location_address: customers[1].address,
        notes: "Client consultation and requirements gathering",
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    await queryInterface.bulkInsert("time_entries", timeEntries);

    console.log("Sample data with new structure created successfully");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("time_entries", null, {});
    await queryInterface.bulkDelete("activities", null, {});
    await queryInterface.bulkDelete("processes", null, {});
    await queryInterface.bulkDelete("customers", null, {});
    await queryInterface.bulkDelete("user_organizations", null, {});
    await queryInterface.bulkDelete("organizations", null, {});
    await queryInterface.bulkDelete("users", null, {});

    console.log("Sample data rolled back");
  },
};
