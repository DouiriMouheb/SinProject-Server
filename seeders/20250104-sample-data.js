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

    // Create customers
    const customers = [
      {
        id: uuidv4(),
        name: "ABC Corporation",
        contact_email: "contact@abccorp.com",
        contact_phone: "+1-555-0123",
        address: "123 Business Ave, City, State 12345",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        name: "XYZ Industries",
        contact_email: "info@xyzind.com",
        contact_phone: "+1-555-0456",
        address: "456 Industrial Blvd, City, State 67890",
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    await queryInterface.bulkInsert("customers", customers);

    // Create work projects
    const workProjects = [
      {
        id: uuidv4(),
        customer_id: customers[0].id,
        name: "Website Redesign",
        description: "Complete redesign of the company website",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        customer_id: customers[0].id,
        name: "Mobile App Development",
        description: "Development of iOS and Android mobile applications",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        customer_id: customers[1].id,
        name: "Database Migration",
        description: "Migration from legacy system to modern database",
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    await queryInterface.bulkInsert("work_projects", workProjects);

    // Create processes
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
        name: "Project Management",
        description: "Project management and coordination activities",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        name: "Quality Assurance",
        description: "Testing and quality assurance activities",
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    await queryInterface.bulkInsert("processes", processes);

    // Create activities
    const activities = [
      // Software Development activities
      {
        id: uuidv4(),
        process_id: processes[0].id,
        name: "Requirements Analysis",
        description: "Analyzing and documenting project requirements",
        // estimatedMinutes: 120,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        process_id: processes[0].id,
        name: "Design & Architecture",
        description: "System design and architecture planning",
        // estimatedMinutes: 180,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        process_id: processes[0].id,
        name: "Development",
        description: "Code development and implementation",
        // estimatedMinutes: 240,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        process_id: processes[0].id,
        name: "Code Review",
        description: "Peer review of code changes",
        // estimatedMinutes: 60,
        created_at: new Date(),
        updated_at: new Date(),
      },

      // Project Management activities
      {
        id: uuidv4(),
        process_id: processes[1].id,
        name: "Planning",
        description: "Project planning and scheduling",
        // estimatedMinutes: 90,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        process_id: processes[1].id,
        name: "Team Meetings",
        description: "Team coordination and status meetings",
        // estimatedMinutes: 45,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        process_id: processes[1].id,
        name: "Client Communication",
        description: "Communication with clients and stakeholders",
        // estimatedMinutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      },

      // Quality Assurance activities
      {
        id: uuidv4(),
        process_id: processes[2].id,
        name: "Test Planning",
        description: "Planning and designing test cases",
        // estimatedMinutes: 120,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        process_id: processes[2].id,
        name: "Manual Testing",
        description: "Manual testing of features and functionality",
        // estimatedMinutes: 180,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        process_id: processes[2].id,
        name: "Bug Reporting",
        description: "Documenting and reporting bugs",
        // estimatedMinutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    await queryInterface.bulkInsert("activities", activities);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("activities", null, {});
    await queryInterface.bulkDelete("processes", null, {});
    await queryInterface.bulkDelete("work_projects", null, {});
    await queryInterface.bulkDelete("customers", null, {});
    await queryInterface.bulkDelete("users", null, {});
  },
};
