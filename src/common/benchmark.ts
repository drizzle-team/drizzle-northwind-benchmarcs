import { bench, group, run } from "mitata";
import Database from "better-sqlite3";
import { asc, eq, ilike, like } from "drizzle-orm/expressions";
import { alias, SQLiteConnector } from "drizzle-orm-sqlite";
import { Database as DatabaseInit } from "../kysely/db";
import { sql } from "drizzle-orm";
import { placeholder } from "drizzle-orm/sql";
import knx from "knex";
import { DataSource, Db } from "typeorm";
import { PrismaClient } from "@prisma/client";
import {
  employees,
  customers,
  suppliers,
  products,
  orders,
  details,
} from "../drizzle/schema";
import {
  customerIds,
  customerSearches,
  employeeIds,
  orderIds,
  productIds,
  productSearches,
  supplierIds,
} from "./meta";
import { Customer } from "@/typeorm/entities/customers";
import { Employee } from "@/typeorm/entities/employees";
import { Supplier } from "@/typeorm/entities/suppliers";
import { Order } from "@/typeorm/entities/orders";
import { Product } from "@/typeorm/entities/products";
import { Detail } from "@/typeorm/entities/details";
import { Kysely, SqliteDialect, sql as k_sql } from "kysely";
import { MemoryCacheAdapter, MikroORM, QueryOrder } from "@mikro-orm/core";
import { TsMorphMetadataProvider } from "@mikro-orm/reflection";
import { SqlEntityManager, SqliteDriver } from "@mikro-orm/sqlite";
import { Customer as m_Customer } from "@/mikro/entities/customers";
import { Detail as m_Detail } from "@/mikro/entities/details";
import { Employee as m_Employee } from "@/mikro/entities/employees";
import { Order as m_Order } from "@/mikro/entities/orders";
import { Product as m_Product } from "@/mikro/entities/products";
import { Supplier as m_Supplier } from "@/mikro/entities/suppliers";

const instance = new Database("nw.sqlite");
const drizzle = new SQLiteConnector(new Database("nw.sqlite")).connect();

const knex = knx({
  client: "better-sqlite3",
  // client: "sqlite3",
  connection: {
    filename: "nw.sqlite",
  },
  useNullAsDefault: true,
});

const typeorm = new DataSource({
  type: "sqlite",
  database: "nw.sqlite",
  entities: [Customer, Employee, Supplier, Order, Product, Detail],
});

const prisma = new PrismaClient();

const kysely = new Kysely<DatabaseInit>({
  dialect: new SqliteDialect({
    database: new Database("nw.sqlite"),
  }),
});

let mikro: SqlEntityManager<SqliteDriver>;

const getMikroOrmConnect = async () => {
  const orm = await MikroORM.init<SqliteDriver>({
    type: "sqlite",
    dbName: "nw.sqlite",
    entities: [
      m_Customer,
      m_Employee,
      m_Order,
      m_Supplier,
      m_Product,
      m_Detail,
    ],
    metadataProvider: TsMorphMetadataProvider,
  });
  mikro = orm.em.fork();
};

group("select * from customer", () => {
  bench("b3", () => {
    instance.prepare('select * from "customer"').all();
  });

  const sql = instance.prepare('select * from "customer"');
  bench("b3:p", () => {
    sql.all();
  });

  bench("drizzle", () => {
    drizzle.select(customers).execute();
  });

  const prep = drizzle.select(customers);
  bench("drizzle:p", () => {
    prep.execute();
  });

  bench("knex", async () => {
    await knex("customer");
  });

  bench("kysely", async () => {
    await kysely.selectFrom("customer").selectAll().execute();
  });

  bench("mikro", async () => {
    await mikro.find(m_Customer, {});
    mikro.clear();
  });

  const repo = typeorm.getRepository(Customer);
  bench("typeorm", async () => {
    await repo.find();
  });

  bench("prisma", async () => {
    await prisma.customer.findMany();
  });
});

group("select * from customer where id = ?", () => {
  bench("b3", () => {
    customerIds.forEach((id) => {
      instance.prepare("select * from customer where id = ?").get(id);
    });
  });

  const sql = instance.prepare("select * from customer where id = ?");

  bench("b3:p", () => {
    customerIds.forEach((id) => {
      sql.get(id);
    });
  });

  bench("drizzle", () => {
    customerIds.forEach((id) => {
      drizzle.select(customers).where(eq(customers.id, id)).execute();
    });
  });

  const prepared = drizzle
    .select(customers)
    .where(eq(customers.id, placeholder("userId")))
    .prepare();

  bench("drizzle:p", () => {
    customerIds.forEach((id) => {
      prepared.execute({ userId: id });
    });
  });

  bench("knex", async () => {
    for (const id of customerIds) {
      await knex("customer").where({ id });
    }
  });

  bench("kysely", async () => {
    for (const id of customerIds) {
      await kysely
        .selectFrom("customer")
        .selectAll()
        .where("customer.id", "=", id)
        .execute();
    }
  });

  bench("mikro", async () => {
    for (const id of customerIds) {
      await mikro.findOne(m_Customer, { id });
    }
    mikro.clear();
  });

  const repo = typeorm.getRepository(Customer);
  bench("typeorm", async () => {
    for (const id of customerIds) {
      await repo.createQueryBuilder().where("id = :id", { id }).getOne();
    }
  });

  bench("prisma", async () => {
    for (const id of customerIds) {
      await prisma.customer.findMany({
        where: {
          id,
        },
      });
    }
  });
});

group("select * from customer where company_name like ?", () => {
  const sql1 = instance.prepare(
    "select * from customer where lower(company_name) like ?"
  );

  bench("b3", () => {
    customerSearches.forEach((it) => {
      sql1.all(`%${it}%`);
    });
  });

  const drz = drizzle
    .select(customers)
    .where(sql`lower(${customers.companyName}) like ${placeholder("name")}`)
    .prepare();

  bench("drizzle:p", () => {
    customerSearches.forEach((it) => {
      drz.execute({ name: `%${it}%` });
    });
  });

  bench("knex", async () => {
    for (const it of customerSearches) {
      await knex("customer").whereRaw("lower(company_name) LIKE ?", [
        `%${it}%`,
      ]);
    }
  });

  bench("kysely", async () => {
    for (const it of customerSearches) {
      await kysely
        .selectFrom("customer")
        .selectAll()
        .where(k_sql`company_name`, "like", `%${it}%`)
        .execute();
    }
  });

  bench("mikro", async () => {
    for (const it of customerSearches) {
      await mikro.find(m_Customer, {
        companyName: { $like: `%${it}%` },
      });
    }
    mikro.clear();
  });

  const repo = typeorm.getRepository(Customer);
  bench("typeorm", async () => {
    for (const it of customerSearches) {
      await repo
        .createQueryBuilder()
        .where("lower(company_name) like :company", { company: `%${it}%` })
        .getMany();
    }
  });

  bench("prisma", async () => {
    for (const it of customerSearches) {
      await prisma.customer.findMany({
        where: {
          companyName: {
            contains: it,
          },
        },
      });
    }
  });
});

group('"SELECT * FROM employee"', () => {
  bench("b3", () => {
    instance.prepare("SELECT * FROM employee").all();
  });

  const sql = instance.prepare("SELECT * FROM employee");
  bench("b3:p", () => {
    sql.all();
  });

  bench("drizzle", () => {
    drizzle.select(employees).execute();
  });

  const prep = drizzle.select(employees);
  bench("drizzle:p", () => {
    prep.execute();
  });

  bench("knex", async () => {
    await knex("employee");
  });

  bench("kysely", async () => {
    await kysely.selectFrom("employee").selectAll().execute();
  });

  bench("mikro", async () => {
    await mikro.find(m_Employee, {});
    mikro.clear();
  });

  bench("typeorm", async () => {
    await typeorm.getRepository(Employee).find();
  });

  bench("prisma", async () => {
    await prisma.employee.findMany();
  });
});

/////
group("select * from employee where id = ?", () => {
  bench("b3", () => {
    employeeIds.forEach((it) => {
      instance
        .prepare(
          `SELECT e1.*,
        e2.id AS e2_id,
        e2.last_name AS e2_last_name,
        e2.first_name AS e2_first_name,
        e2.title AS e2_title,
        e2.title_of_courtesy AS e2_title_of_courtesy,
        e2.birth_date AS e2_birth_date,
        e2.hire_date AS e2_hire_date,
        e2.address AS e2_address,
        e2.city AS e2_city,
        e2.postal_code AS e2_postal_code,
        e2.country AS e2_country,
        e2.home_phone AS e2_home_phone,
        e2.extension AS e2_extension,
        e2.notes AS e2_notes,
        e2.reports_to AS e2_reports_to
        FROM employee AS e1
        LEFT JOIN employee AS e2
        ON e2.id = e1.reports_to
        WHERE e1.id = ?`
        )
        .get(it);
    });
  });

  const sql = instance.prepare(
    `SELECT e1.*,
    e2.id AS e2_id,
    e2.last_name AS e2_last_name,
    e2.first_name AS e2_first_name,
    e2.title AS e2_title,
    e2.title_of_courtesy AS e2_title_of_courtesy,
    e2.birth_date AS e2_birth_date,
    e2.hire_date AS e2_hire_date,
    e2.address AS e2_address,
    e2.city AS e2_city,
    e2.postal_code AS e2_postal_code,
    e2.country AS e2_country,
    e2.home_phone AS e2_home_phone,
    e2.extension AS e2_extension,
    e2.notes AS e2_notes,
    e2.reports_to AS e2_reports_to
    FROM employee AS e1
    LEFT JOIN employee AS e2
    ON e2.id = e1.reports_to
    WHERE e1.id = ?`
  );
  bench("b3:p", () => {
    employeeIds.forEach((id) => {
      sql.get(id);
    });
  });

  bench("drizzle", () => {
    const e2 = alias(employees, "recipient");

    employeeIds.forEach((id) => {
      drizzle
        .select(employees)
        .leftJoin(e2, eq(e2.id, employees.reportsTo))
        .where(eq(employees.id, id))
        .execute();
    });
  });

  const prep = drizzle
    .select(customers)
    .where(eq(customers.id, placeholder("customerId")))
    .prepare();

  bench("drizzle:p", () => {
    employeeIds.forEach((id) => {
      prep.execute({ customerId: id });
    });
  });

  bench("knex", async () => {
    for (const id of employeeIds) {
      await knex("employee as e1")
        .select([
          "e1.*",
          "e2.id as e2_id",
          "e2.last_name as e2_last_name",
          "e2.first_name as e2_first_name",
          "e2.title as e2_title",
          "e2.title_of_courtesy as e2_title_of_courtesy",
          "e2.birth_date as e2_birth_date",
          "e2.hire_date as e2_hire_date",
          "e2.address as e2_address",
          "e2.city as e2_city",
          "e2.postal_code as e2_postal_code",
          "e2.country as e2_country",
          "e2.home_phone as e2_home_phone",
          "e2.extension as e2_extension",
          "e2.notes as e2_notes",
          "e2.reports_to as e2_reports_to",
        ])
        .whereRaw("e1.id = ?", [id])
        .leftJoin("employee as e2", "e1.reports_to", "e2.id");
    }
  });

  bench("kysely", async () => {
    for (const id of employeeIds) {
      await kysely
        .selectFrom("employee as e1")
        .selectAll()
        .where("e1.id", "=", id)
        .leftJoin(
          kysely
            .selectFrom("employee as e2")
            .select([
              "id as e2_id",
              "last_name as e2_last_name",
              "first_name as e2_first_name",
              "title as e2_title",
              "title_of_courtesy as e2_title_of_courtesy",
              "birth_date as e2_birth_date",
              "hire_date as e2_hire_date",
              "address as e2_address",
              "city as e2_city",
              "postal_code as e2_postal_code",
              "country as e2_country",
              "home_phone as e2_home_phone",
              "extension as e2_extension",
              "notes as e2_notes",
              "reports_to as e2_reports_to",
            ])
            .as("e2"),
          "e2.e2_id",
          "e1.reports_to"
        )
        .execute();
    }
  });

  bench("mikro", async () => {
    for (const id of employeeIds) {
      await mikro.findOne(Employee, { id }, { populate: ["recipient"] });
    }
    mikro.clear();
  });

  bench("typeorm", async () => {
    for (const id of employeeIds) {
      await typeorm
        .getRepository(Employee)
        .createQueryBuilder("employee")
        .leftJoinAndSelect("employee.recipient", "recipients")
        .where("employee.id = :id", { id })
        .getOne();
    }
  });

  bench("prisma", async () => {
    for (const id of employeeIds) {
      await prisma.employee.findUnique({
        where: {
          id,
        },
        include: {
          recipient: true,
        },
      });
    }
  });
});

/////

group("SELECT * FROM supplier", () => {
  bench("b3", () => {
    instance.prepare("SELECT * FROM supplier").all();
  });

  const sql = instance.prepare("SELECT * FROM supplier");
  bench("b3:p", () => {
    sql.all();
  });

  bench("drizzle", () => {
    drizzle.select(suppliers).execute();
  });

  const prep = drizzle.select(suppliers);

  bench("drizzle:p", () => {
    prep.execute();
  });

  bench("knex", async () => {
    await knex("supplier");
  });

  bench("kysely", async () => {
    await kysely.selectFrom("supplier").selectAll().execute();
  });

  bench("mikro", async () => {
    await mikro.find(m_Supplier, {});
    mikro.clear();
  });

  bench("typeorm", async () => {
    await typeorm.getRepository(Supplier).find();
  });

  bench("prisma", async () => {
    await prisma.supplier.findMany();
  });
});

/////

group("select * from supplier where id = ?", () => {
  bench("b3", () => {
    supplierIds.forEach((it) => {
      instance.prepare("SELECT * FROM supplier WHERE supplier.id = ?").get(it);
    });
  });

  const sql = instance.prepare("SELECT * FROM supplier WHERE supplier.id = ?");
  bench("b3:p", () => {
    supplierIds.forEach((it) => {
      sql.get(it);
    });
  });

  bench("drizzle", () => {
    supplierIds.forEach((id) => {
      drizzle.select(suppliers).where(eq(suppliers.id, id)).execute();
    });
  });

  const prep = drizzle
    .select(suppliers)
    .where(eq(suppliers.id, placeholder("supplierId")))
    .prepare();

  bench("drizzle:p", () => {
    supplierIds.forEach((id) => {
      prep.execute({ supplierId: id });
    });
  });

  bench("knex", async () => {
    for (const id of supplierIds) {
      await knex("supplier").where({ id }).first();
    }
  });

  bench("kysely", async () => {
    for (const id of supplierIds) {
      await kysely
        .selectFrom("supplier")
        .selectAll()
        .where("supplier.id", "=", id)
        .execute();
    }
  });

  bench("mikro", async () => {
    for (const id of supplierIds) {
      await mikro.findOne(m_Supplier, { id });
    }
    mikro.clear();
  });

  bench("typeorm", async () => {
    for (const id of supplierIds) {
      await typeorm.getRepository(Supplier).findOneBy({ id });
    }
  });

  bench("prisma", async () => {
    for (const id of supplierIds) {
      await prisma.supplier.findUnique({
        where: {
          id,
        },
      });
    }
  });
});

/////
group("SELECT * FROM product", () => {
  bench("b3", () => {
    instance.prepare("SELECT * FROM product").all();
  });

  const sql = instance.prepare("SELECT * FROM product");
  bench("b3:p", () => {
    sql.all();
  });

  bench("drizzle", () => {
    drizzle.select(products).execute();
  });

  const prep = drizzle.select(products);

  bench("drizzle:p", () => {
    prep.execute();
  });

  bench("knex", async () => {
    await knex("product");
  });

  bench("kysely", async () => {
    await kysely.selectFrom("product").selectAll().execute();
  });

  bench("mikro", async () => {
    await mikro.find(m_Product, {});
    mikro.clear();
  });

  bench("typeorm", async () => {
    await typeorm.getRepository(Product).find();
  });

  bench("prisma", async () => {
    await prisma.product.findMany();
  });
});

////
group("SELECT * FROM product LEFT JOIN supplier WHERE product.id = ?", () => {
  bench("b3", () => {
    productIds.forEach((it) => {
      instance
        .prepare(
          `SELECT * FROM product LEFT JOIN supplier
        ON product.supplier_id = supplier.id
        WHERE product.id = ?`
        )
        .all(it);
    });
  });

  const sql = instance.prepare(
    `SELECT * FROM product LEFT JOIN supplier
  ON product.supplier_id = supplier.id
  WHERE product.id = ?`
  );

  bench("b3:p", () => {
    productIds.forEach((it) => {
      sql.get(it);
    });
  });

  bench("drizzle", () => {
    productIds.forEach((id) => {
      drizzle
        .select(products)
        .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
        .where(eq(products.id, id))
        .execute();
    });
  });

  const prep = drizzle
    .select(products)
    .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
    .where(eq(products.id, placeholder("productId")))
    .prepare();

  bench("drizzle:p", () => {
    productIds.forEach((id) => {
      prep.execute({ productId: id });
    });
  });

  bench("knex", async () => {
    for (const id of productIds) {
      await knex("product")
        .select([
          "product.*",
          "supplier.id as s_id",
          "company_name",
          "contact_name",
          "contact_title",
          "address",
          "city",
          "region",
          "postal_code",
          "country",
          "phone",
        ])
        .whereRaw("product.id = ?", [id])
        .leftJoin("supplier", "supplier.id", "product.supplier_id");
    }
  });

  bench("kysely", async () => {
    for (const id of productIds) {
      await kysely
        .selectFrom("product")
        .selectAll()
        .where("product.id", "=", id)
        .leftJoin(
          kysely
            .selectFrom("supplier")
            .select([
              "id as s_id",
              "company_name",
              "contact_name",
              "contact_title",
              "address",
              "city",
              "region",
              "postal_code",
              "country",
              "phone",
            ])
            .as("s1"),
          "s1.s_id",
          "product.supplier_id"
        )
        .execute();
    }
  });

  bench("mikro", async () => {
    for (const id of productIds) {
      await mikro.findOne(m_Product, { id }, { populate: ["supplier"] });
    }
    mikro.clear();
  });

  bench("typeorm", async () => {
    for (const id of productIds) {
      await typeorm
        .getRepository(Product)
        .createQueryBuilder("product")
        .leftJoinAndSelect("product.supplier", "supplier")
        .where("product.id = :id", { id })
        .getOne();
    }
  });

  bench("prisma", async () => {
    for (const id of productIds) {
      await prisma.product.findUnique({
        where: {
          id,
        },
        include: {
          supplier: true,
        },
      });
    }
  });
});

////////////
group("SELECT * FROM product WHERE product.name LIKE ?", () => {
  bench("b3", () => {
    productSearches.forEach((it) => {
      instance
        .prepare("SELECT * FROM product WHERE product.name LIKE ?")
        .all(`%${it}%`);
    });
  });

  const prep = instance.prepare(
    "SELECT * FROM product WHERE product.name LIKE ?"
  );
  bench("b3:p", () => {
    productSearches.forEach((it) => {
      prep.all(it);
    });
  });

  bench("drizzle", () => {
    productSearches.forEach((it) => {
      drizzle
        .select(products)
        .where(like(products.name, `%${it}%`))
        .execute();
    });
  });

  const prepare = drizzle
    .select(products)
    .where(sql`lower(${products.name}) like ${placeholder("name")}`)
    .prepare();

  bench("drizzle:p", () => {
    productSearches.forEach((it) => {
      prepare.execute({ name: `%${it}%` });
    });
  });

  bench("knex", async () => {
    for (const it of productSearches) {
      await knex("product").whereRaw("name LIKE ?", [`%${it}%`]);
    }
  });

  bench("kysely", async () => {
    for (const it of productSearches) {
      await kysely
        .selectFrom("product")
        .selectAll()
        .where(k_sql`name`, "like", `%${it}%`)
        .execute();
    }
  });

  bench("mikro", async () => {
    for (const it of productSearches) {
      await mikro.find(m_Product, {
        name: { $like: `%${it}%` },
      });
    }
    mikro.clear();
  });

  bench("typeorm", async () => {
    for (const it of productSearches) {
      await typeorm
        .getRepository(Product)
        .createQueryBuilder("product")
        .where("product.name like :name", { name: `%${it}%` })
        .getMany();
    }
  });

  bench("prisma", async () => {
    for (const it of productSearches) {
      await prisma.product.findMany({
        where: {
          name: {
            contains: it,
          },
        },
      });
    }
  });
});

group("select all order with sum and count", () => {
  bench("b3", () => {
    instance
      .prepare(
        `SELECT o.id, o.shipped_date, o.ship_name, o.ship_city, o.ship_country,
        COUNT(od.product_id) AS products_count,
        SUM(od.quantity) AS quantity_sum,
        SUM(od.quantity * unit_price) AS total_price
        FROM "order" AS o LEFT JOIN "order_detail" AS od ON od.order_id = o.id
        GROUP BY o.id
        ORDER BY o.id ASC`
      )
      .all();
  });

  const prep = instance.prepare(
    `SELECT o.id, o.shipped_date, o.ship_name, o.ship_city, o.ship_country,
      COUNT(od.product_id) AS products_count,
      SUM(od.quantity) AS quantity_sum,
      SUM(od.quantity * unit_price) AS total_price
      FROM "order" AS o LEFT JOIN "order_detail" AS od ON od.order_id = o.id
      GROUP BY o.id
      ORDER BY o.id ASC`
  );
  bench("b3:p", () => {
    prep.all();
  });

  bench("drizzle", () => {
    drizzle
      .select(orders)
      .fields({
        id: orders.id,
        shippedDate: orders.shippedDate,
        shipName: orders.shipName,
        shipCity: orders.shipCity,
        shipCountry: orders.shipCountry,
        productsCount: sql`count(${details.productId})`.as<number>(),
        quantitySum: sql`sum(${details.quantity})`.as<number>(),
        totalPrice:
          sql`sum(${details.quantity} * ${details.unitPrice})`.as<number>(),
      })
      .leftJoin(details, eq(orders.id, details.orderId))
      .groupBy(orders.id)
      .orderBy(asc(orders.id))
      .execute();
  });

  const prepare = drizzle
    .select(orders)
    .fields({
      id: orders.id,
      shippedDate: orders.shippedDate,
      shipName: orders.shipName,
      shipCity: orders.shipCity,
      shipCountry: orders.shipCountry,
      productsCount: sql`count(${details.productId})`.as<number>(),
      quantitySum: sql`sum(${details.quantity})`.as<number>(),
      totalPrice:
        sql`sum(${details.quantity} * ${details.unitPrice})`.as<number>(),
    })
    .leftJoin(details, eq(orders.id, details.orderId))
    .groupBy(orders.id)
    .orderBy(asc(orders.id))
    .prepare();

  bench("drizzle:p", () => {
    prepare.execute();
  });

  bench("knex", async () => {
    await knex("order")
      .select([
        "order.id",
        "order.shipped_date",
        "order.ship_name",
        "order.ship_city",
        "order.ship_country",
      ])
      .leftJoin("order_detail", "order_detail.order_id", "order.id")
      .count("product_id as products_count")
      .sum("quantity as quantity_sum")
      .sum({ total_price: knex.raw("?? * ??", ["quantity", "unit_price"]) })
      .groupBy("order.id")
      .orderBy("order.id", "asc");
  });

  bench("kysely", async () => {
    await kysely
      .selectFrom("order")
      .select([
        "order.id",
        "order.shipped_date",
        "order.ship_name",
        "order.ship_city",
        "order.ship_country",
        kysely.fn.count("product_id").as("products_count"),
        kysely.fn.sum("quantity").as("quantity_sum"),
        k_sql`SUM(quantity * unit_price)`.as("total_price"),
      ])
      .leftJoin("order_detail", "order_detail.order_id", "order.id")
      .groupBy("order.id")
      .orderBy("order.id", "asc")
      .execute();
  });

  // query fails with large amount of data
  // bench("mikro", async () => {

  //   mikro.clear();
  // });

  bench("typeorm", async () => {
    await typeorm
      .getRepository(Order)
      .createQueryBuilder("order")
      .leftJoin("order.details", "order_detail")
      .addSelect([
        "COUNT(product_id) AS products_count",
        "SUM(quantity) AS quantity_sum",
        "SUM(quantity * unit_price) AS total_price",
      ])
      .addGroupBy("order.id")
      .orderBy("order.id")
      .getRawMany();
  });

  bench("prisma", async () => {
    const result = await prisma.order.findMany({
      include: {
        details: true,
      },
    });
    const orders = result.map((item) => {
      return {
        id: item.id,
        shippedDate: item.shippedDate,
        shipName: item.shipName,
        shipCity: item.shipCity,
        shipCountry: item.shipCountry,
        productsCount: item.details.length,
        quantitySum: item.details.reduce(
          (sum, deteil) => (sum += +deteil.quantity),
          0
        ),
        totalPrice: item.details.reduce(
          (sum, deteil) => (sum += +deteil.quantity * +deteil.unitPrice),
          0
        ),
      };
    });
  });
});

////

group("SELECT * FROM order_detail WHERE order_id = ?", () => {
  bench("b3", () => {
    orderIds.forEach((it) => {
      instance
        .prepare(
          `SELECT * FROM order_detail AS od
        LEFT JOIN "product" AS p ON od.product_id = p.id
        LEFT JOIN "order" AS o ON od.order_id = o.id
        WHERE od.order_id = ?`
        )
        .all(it);
    });
  });

  const sql = instance.prepare(
    `SELECT * FROM order_detail AS od
    LEFT JOIN "product" AS p ON od.product_id = p.id
    LEFT JOIN "order" AS o ON od.order_id = o.id
    WHERE od.order_id = ?`
  );
  bench("b3:p", () => {
    orderIds.forEach((it) => {
      sql.all(it);
    });
  });

  bench("drizzle", () => {
    orderIds.forEach((id) => {
      drizzle
        .select(details)
        .leftJoin(orders, eq(details.orderId, orders.id))
        .leftJoin(products, eq(details.productId, products.id))
        .where(eq(details.orderId, id))
        .execute();
    });
  });

  const prep = drizzle
    .select(details)
    .leftJoin(orders, eq(details.orderId, orders.id))
    .leftJoin(products, eq(details.productId, products.id))
    .where(eq(details.orderId, placeholder("orderId")))
    .prepare();

  bench("drizzle:p", () => {
    orderIds.forEach((id) => {
      prep.execute({ orderId: id });
    });
  });

  const prep2 = drizzle
    .select(orders)
    .leftJoin(details, eq(orders.id, details.orderId))
    .leftJoin(products, eq(details.productId, products.id))
    .where(eq(orders.id, placeholder("orderId")))
    .prepare();

  bench("drizzle:p2", () => {
    orderIds.forEach((id) => {
      prep2.execute({ orderId: id });
    });
  });

  bench("knex", async () => {
    for (const id of orderIds) {
      await knex("order_detail")
        .select([
          "order_detail.*",
          "order.id as o_id",
          "order_date",
          "required_date",
          "shipped_date",
          "ship_via",
          "freight",
          "ship_name",
          "ship_city",
          "ship_region",
          "ship_postal_code",
          "ship_country",
          "customer_id",
          "employee_id",
          "product.id as p_id",
          "name",
          "quantity_per_unit",
          "product.unit_price as p_unit_price",
          "units_in_stock",
          "units_on_order",
          "reorder_level",
          "discontinued",
          "supplier_id",
        ])
        .whereRaw("order_detail.order_id = ?", id)
        .leftJoin("product", "product.id", "order_detail.product_id")
        .leftJoin("order", "order.id", "order_detail.order_id");
    }
  });

  bench("kysely", async () => {
    for (const id of orderIds) {
      await kysely
        .selectFrom("order_detail")
        .selectAll()
        .where("order_id", "=", id)
        .leftJoin(
          kysely
            .selectFrom("order")
            .select([
              "order.id as o_id",
              "order_date",
              "required_date",
              "shipped_date",
              "ship_via",
              "freight",
              "ship_name",
              "ship_city",
              "ship_region",
              "ship_postal_code",
              "ship_country",
              "customer_id",
              "employee_id",
            ])
            .as("o"),
          "o.o_id",
          "order_detail.order_id"
        )
        .leftJoin(
          kysely
            .selectFrom("product")
            .select([
              "product.id as p_id",
              "name",
              "quantity_per_unit",
              "product.unit_price as p_unit_price",
              "units_in_stock",
              "units_on_order",
              "reorder_level",
              "discontinued",
              "supplier_id",
            ])
            .as("p"),
          "p.p_id",
          "order_detail.product_id"
        )
        .execute();
    }
  });

  bench("mikro", async () => {
    for (const id of orderIds) {
      await mikro.find(
        m_Detail,
        { orderId: id },
        { populate: ["order", "product"] }
      );
    }
    mikro.clear();
  });

  bench("typeorm", async () => {
    for (const id of orderIds) {
      await typeorm.getRepository(Detail).find({
        relations: {
          order: true,
          product: true,
        },
        where: {
          orderId: id
        }
      });
    }
  });

  bench("prisma", async () => {
    for (const id of orderIds) {
      await prisma.detail.findMany({
        where: {
          orderId: id,
        },
        include: {
          order: true,
          product: true,
        },
      });
    }
  });
});

const main = async () => {
  await typeorm.initialize();
  await getMikroOrmConnect();

  await run();
  process.exit(1);
};

const test = async () => {
  await getMikroOrmConnect();
  await typeorm.initialize();

  // const drz = drizzle
  //   .select(customers)
  //   .where(sql`lower(${customers.companyName}) like ${placeholder("name")}`)
  //   .prepare();

  // console.log(
  //   typeorm
  //     .getRepository(Customer)
  //     .createQueryBuilder()
  //     .where("company_name like :company")
  //     .getSql()
  // );
  // console.log(db("customer").whereRaw("lower(company_name) LIKE %ha%"))
  
  for (const id of [customerIds[0]]) {
    // console.log(await mikro.findOne(m_Customer, { id }));
    // console.log(
    //   drizzle.select(customers).where(eq(customers.id, id)).execute()
    // );
    // drizzle
    //   .update(customers)
    //   .set({ fax: "faks2" })
    //   .where(eq(customers.id, id))
    //   .execute();
    // console.log(JSON.stringify(await mikro.findOne(m_Customer, { id })));
    // console.log(
    //   drizzle.select(customers).where(eq(customers.id, id)).execute()
    // );
  }
  process.exit(1);
};

main();
// test();

// console.log(orderIds);
